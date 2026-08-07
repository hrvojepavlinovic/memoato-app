import { useEffect, useMemo, useState } from "react";
import { deleteEvent, getCategoryEvents, queryClientInitialized, updateEvent, useQuery } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { parseNumberInput } from "../../shared/lib/parseNumberInput";
import type { CategoryEventItem } from "../types";
import { usePrivacy } from "../../privacy/PrivacyProvider";
import { decryptEventNote } from "../../privacy/decryptors";
import { encryptUtf8ToEncryptedString, isEncryptedString } from "../../privacy/crypto";
import { localDeleteEvent, localGetCategoryEvents, localUpdateEvent } from "../local";
import { categoryEntryLabel, formatDurationMinutes, isBinaryCategoryType, normalizeCategoryAmount, type CategoryType } from "../categoryEntrySemantics";
import { workoutDetailsFromEventData, type WorkoutComparison, type WorkoutMetricValue } from "../../memory/workout";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` + `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function endOfTodayDatetimeInputMax(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T23:59`;
}

function formatValue(v: number | null): string {
  if (v == null) return "";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function formatWorkoutMetric(metric: WorkoutMetricValue): string {
  if (metric.key === "duration_seconds") {
    const seconds = Math.round(metric.value);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return `${hours}:${pad2(minutes)}:${pad2(remainder)}`;
  }
  if (metric.key === "distance") return `${metric.value.toFixed(2)} km`;
  if (metric.key === "active_kcal") return `${formatValue(metric.value)} active kcal`;
  if (metric.key === "total_kcal") return `${formatValue(metric.value)} total kcal`;
  if (metric.key === "heart_rate_avg") return `${formatValue(metric.value)} bpm avg`;
  if (metric.key === "heart_rate_min") return `${formatValue(metric.value)} bpm min`;
  if (metric.key === "heart_rate_max") return `${formatValue(metric.value)} bpm max`;
  return `${formatValue(metric.value)}/10${metric.label ? ` ${metric.label}` : ""}`;
}

function formatComparison(comparison: WorkoutComparison): string {
  const sign = comparison.delta > 0 ? "+" : "";
  const value = Number.isInteger(comparison.delta) ? String(comparison.delta) : comparison.delta.toFixed(2);
  const unit = comparison.unit === "seconds" ? "s" : comparison.unit;
  return `${sign}${value} ${unit}`;
}

type RowState = {
  amount: string;
  occurredAt: string;
  note: string;
  noteDirty: boolean;
  saving: boolean;
};

export function HistoryList({
  categoryId,
  categoryType,
  categorySlug,
  categoryTitle,
  step,
  isDecimal = false,
}: {
  categoryId: string;
  categoryType: CategoryType;
  categorySlug?: string | null;
  categoryTitle?: string | null;
  step: number;
  isDecimal?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [extraItems, setExtraItems] = useState<CategoryEventItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rowById, setRowById] = useState<Record<string, RowState>>({});
  const privacy = usePrivacy();
  const isLocal = privacy.mode === "local";
  const isBinary = isBinaryCategoryType(categoryType);
  const maxOccurredAt = endOfTodayDatetimeInputMax();

  const eventsQuery = useQuery(getCategoryEvents, { categoryId, take: 50 }, { enabled: !isLocal });
  const [localItems, setLocalItems] = useState<CategoryEventItem[] | null>(null);
  const items = useMemo(
    () => (isLocal ? (localItems ? [...localItems, ...extraItems] : null) : eventsQuery.data ? [...eventsQuery.data, ...extraItems] : null),
    [eventsQuery.data, extraItems, isLocal, localItems],
  );

  useEffect(() => {
    if (!isLocal) return;
    if (!isOpen) return;
    if (!privacy.userId) return;
    setLocalItems(null);
    localGetCategoryEvents({
      userId: privacy.userId,
      categoryId,
      take: 50,
    }).then((d) => setLocalItems(d));
  }, [categoryId, isLocal, isOpen, privacy.userId]);

  useEffect(() => {
    if (!isOpen) return;
    setExtraItems([]);
    setHasMore(true);
    setRowById({});
  }, [categoryId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isLocal) {
      if (!localItems) return;
      setHasMore(localItems.length >= 50);
      return;
    }
    if (!eventsQuery.isSuccess) return;
    setHasMore((eventsQuery.data?.length ?? 0) >= 50);
  }, [eventsQuery.data, eventsQuery.isSuccess, isLocal, isOpen, localItems]);

  useEffect(() => {
    if (!isLocal) return;
    if (!privacy.userId) return;
    const onChanged = (e: any) => {
      if (e?.detail?.userId !== privacy.userId) return;
      if (!isOpen) return;
      localGetCategoryEvents({
        userId: privacy.userId!,
        categoryId,
        take: 50,
      }).then((d) => setLocalItems(d));
      setExtraItems([]);
    };
    window.addEventListener("memoato:localChanged", onChanged);
    return () => window.removeEventListener("memoato:localChanged", onChanged);
  }, [categoryId, isLocal, isOpen, privacy.userId]);

  useEffect(() => {
    let cancelled = false;
    if (!privacy.key || !items) return;
    (async () => {
      const updates: Array<[string, string]> = [];
      for (const ev of items) {
        if (!ev.data || typeof ev.data !== "object" || Array.isArray(ev.data)) continue;
        const hasEncrypted = isEncryptedString((ev.data as any).noteEnc);
        if (!hasEncrypted) continue;
        const note = await decryptEventNote(privacy.key as CryptoKey, ev.data);
        if (note != null) updates.push([ev.id, note]);
      }
      if (cancelled) return;
      if (updates.length === 0) return;
      setRowById((prev) => {
        const next = { ...prev };
        for (const [id, note] of updates) {
          const ev = items.find((x) => x.id === id);
          if (!ev) continue;
          const existing = next[id];
          if (existing) {
            if (existing.noteDirty) continue;
            if (existing.note.trim()) continue;
            next[id] = { ...existing, note };
            continue;
          }
          next[id] = {
            amount: formatValue(ev.amount),
            occurredAt: toLocalDatetimeInputValue(new Date(ev.occurredAt as any)),
            note,
            noteDirty: false,
            saving: false,
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [items, privacy.key]);

  function ensureRowState(ev: CategoryEventItem): RowState {
    const meta = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? (ev.data as Record<string, unknown>) : {};
    const note = typeof meta.note === "string" ? meta.note : "";
    return (
      rowById[ev.id] ?? {
        amount: formatValue(ev.amount),
        occurredAt: toLocalDatetimeInputValue(new Date(ev.occurredAt as any)),
        note,
        noteDirty: false,
        saving: false,
      }
    );
  }

  async function invalidateStats(): Promise<void> {
    if (isLocal) return;
    const queryClient = await queryClientInitialized;
    await queryClient.invalidateQueries({
      queryKey: ["operations/get-categories"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["operations/get-category-series"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["operations/get-category-line-series"],
    });
  }

  async function onSave(ev: CategoryEventItem) {
    const row = ensureRowState(ev);
    const eventData = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? (ev.data as Record<string, unknown>) : {};
    const amount = normalizeCategoryAmount({
      categoryType,
      requestedAmount: parseNumberInput(row.amount),
      scheduledStatus: typeof eventData.scheduledStatus === "string" ? eventData.scheduledStatus : null,
    });
    if (amount == null) {
      window.alert("Enter a valid number.");
      return;
    }
    if (!row.occurredAt) {
      window.alert("Pick a date/time.");
      return;
    }
    {
      const d = new Date(row.occurredAt);
      if (Number.isNaN(d.getTime())) {
        window.alert("Pick a valid date/time.");
        return;
      }
      const on = new Date(d);
      on.setHours(0, 0, 0, 0);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (on.getTime() > startOfToday.getTime()) {
        window.alert("Future dates are not allowed.");
        return;
      }
    }
    setRowById((prev) => ({ ...prev, [ev.id]: { ...row, saving: true } }));
    try {
      const note = row.note.trim();
      const hasEncrypted = !!(ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) && isEncryptedString((ev.data as any).noteEnc));
      const shouldEncrypt = privacy.mode === "encrypted" || hasEncrypted;

      if (shouldEncrypt) {
        if (!privacy.key || !privacy.cryptoParams) {
          window.alert("Unlock encryption from Profile → Privacy first.");
          return;
        }
        const enc = row.noteDirty ? (note ? await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, note) : null) : undefined;
        if (isLocal) {
          if (!privacy.userId) return;
          await localUpdateEvent({
            userId: privacy.userId,
            eventId: ev.id,
            amount,
            occurredAt: row.occurredAt,
            ...(enc !== undefined ? { noteEnc: enc } : {}),
          } as any);
        } else {
          await updateEvent({
            eventId: ev.id,
            amount,
            occurredAt: row.occurredAt,
            ...(enc !== undefined ? { noteEnc: enc } : {}),
          });
        }
      } else {
        if (isLocal) {
          if (!privacy.userId) return;
          await localUpdateEvent({
            userId: privacy.userId,
            eventId: ev.id,
            amount,
            occurredAt: row.occurredAt,
            ...(row.noteDirty ? { note: note ? note : null } : {}),
          } as any);
        } else {
          await updateEvent({
            eventId: ev.id,
            amount,
            occurredAt: row.occurredAt,
            ...(row.noteDirty ? { note: note ? note : null } : {}),
          });
        }
      }
      await invalidateStats();
      setRowById((prev) => ({
        ...prev,
        [ev.id]: { ...(prev[ev.id] ?? row), note, noteDirty: false },
      }));
    } finally {
      setRowById((prev) => ({
        ...prev,
        [ev.id]: { ...prev[ev.id], saving: false },
      }));
    }
  }

  async function onDelete(ev: CategoryEventItem) {
    if (!window.confirm("Delete this entry?")) return;
    if (isLocal) {
      if (!privacy.userId) return;
      await localDeleteEvent({ userId: privacy.userId, eventId: ev.id });
    } else {
      await deleteEvent({ eventId: ev.id });
    }
    setExtraItems([]);
    setRowById((prev) => {
      const next = { ...prev };
      delete next[ev.id];
      return next;
    });
    await invalidateStats();
    if (!isLocal) await eventsQuery.refetch();
  }

  async function onLoadMore() {
    if (!items || items.length === 0) return;
    const last = items[items.length - 1];
    const before = new Date(last.occurredAt as any).toISOString();
    setLoadingMore(true);
    try {
      const next = isLocal
        ? privacy.userId
          ? await localGetCategoryEvents({
              userId: privacy.userId,
              categoryId,
              take: 50,
              before,
            })
          : []
        : await getCategoryEvents({ categoryId, take: 50, before });
      setExtraItems((prev) => [...prev, ...next]);
      setHasMore(next.length >= 50);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">History</h3>
        <Button variant="ghost" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? "Hide" : "Show"}
        </Button>
      </div>

      {isOpen ? (
        <div className="mt-3">
          {!eventsQuery.isSuccess && eventsQuery.isLoading ? (
            <div className="h-6" />
          ) : items && items.length === 0 ? (
            <div className="text-neutral-600">No entries yet.</div>
          ) : items ? (
            <>
              <div className="space-y-3">
                {items.map((ev) => {
                  const row = ensureRowState(ev);
                  const eventData = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? (ev.data as Record<string, unknown>) : {};
                  const entryLabel = categoryEntryLabel({
                    categorySlug,
                    categoryTitle,
                    scheduledStatus: typeof eventData.scheduledStatus === "string" ? eventData.scheduledStatus : null,
                    amount: ev.amount,
                  });
                  const durationLabel = formatDurationMinutes(ev.duration);
                  const workout = ev.workout ?? workoutDetailsFromEventData(ev.data);
                  const comparisons = ev.workoutComparison ?? [];
                  return (
                    <div key={ev.id} className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-[220px_140px_1fr_220px]">
                      <label className="flex flex-col gap-1">
                        <span className="label">Date & time</span>
                        <div className="h-10 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                          <input
                            type="datetime-local"
                            value={row.occurredAt}
                            max={maxOccurredAt}
                            onChange={(e) =>
                              setRowById((prev) => ({
                                ...prev,
                                [ev.id]: {
                                  ...row,
                                  occurredAt: e.target.value > maxOccurredAt ? maxOccurredAt : e.target.value,
                                },
                              }))
                            }
                            className="h-full w-full min-w-0 appearance-none bg-transparent px-3 text-neutral-900 dark:text-neutral-100"
                            style={{ WebkitAppearance: "none" }}
                          />
                        </div>
                      </label>
                      {isBinary ? (
                        <div className="flex flex-col gap-1">
                          <span className="label">Entry</span>
                          <div className="flex h-10 min-w-0 items-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                            <span className="truncate font-medium">{entryLabel}</span>
                            {durationLabel ? <span className="ml-1 whitespace-nowrap text-neutral-500 dark:text-neutral-400">· {durationLabel}</span> : null}
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col gap-1">
                          <span className="label">Amount</span>
                          <input
                            type={isDecimal ? "text" : "number"}
                            step={isDecimal ? undefined : String(step)}
                            inputMode={isDecimal ? "decimal" : "numeric"}
                            pattern={isDecimal ? "[0-9]*[.,]?[0-9]*" : undefined}
                            value={row.amount}
                            onChange={(e) =>
                              setRowById((prev) => ({
                                ...prev,
                                [ev.id]: { ...row, amount: e.target.value },
                              }))
                            }
                            className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                          />
                        </label>
                      )}
                      <label className="flex flex-col gap-1">
                        <span className="label">Note</span>
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) =>
                            setRowById((prev) => ({
                              ...prev,
                              [ev.id]: {
                                ...row,
                                note: e.target.value,
                                noteDirty: true,
                              },
                            }))
                          }
                          className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                          placeholder="Optional"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:justify-end">
                        <Button className="h-10 w-full sm:w-auto" variant="danger" onClick={() => onDelete(ev)} disabled={row.saving}>
                          Delete
                        </Button>
                        <Button className="h-10 w-full sm:w-auto" onClick={() => onSave(ev)} disabled={row.saving}>
                          {row.saving ? "Saving…" : "Save"}
                        </Button>
                      </div>
                      {workout && workout.metrics.length > 0 ? (
                        <div className="sm:col-span-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                            {workout.metrics.map((metric: WorkoutMetricValue) => (
                              <span key={metric.key}>{formatWorkoutMetric(metric)}</span>
                            ))}
                          </div>
                          {comparisons.length > 0 ? (
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              vs previous matching session: {comparisons.map(formatComparison).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                {hasMore ? (
                  <Button variant="ghost" onClick={onLoadMore} disabled={loadingMore}>
                    Load more
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-red-600">Failed to load history.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
