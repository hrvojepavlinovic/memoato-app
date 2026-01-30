import { useMemo, useState } from "react";
import {
  deleteEvent,
  getCategoryEvents,
  queryClientInitialized,
  updateEvent,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { parseNumberInput } from "../../shared/lib/parseNumberInput";
import type { CategoryEventItem } from "../types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeInputValue(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

function formatValue(v: number | null): string {
  if (v == null) return "";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

type RowState = {
  amount: string;
  occurredAt: string;
  note: string;
  saving: boolean;
};

export function HistoryList({
  categoryId,
  step,
  isDecimal = false,
}: {
  categoryId: string;
  step: number;
  isDecimal?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [extraItems, setExtraItems] = useState<CategoryEventItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rowById, setRowById] = useState<Record<string, RowState>>({});

  const eventsQuery = useQuery(getCategoryEvents, { categoryId, take: 50 });
  const items = useMemo(
    () => (eventsQuery.data ? [...eventsQuery.data, ...extraItems] : null),
    [eventsQuery.data, extraItems],
  );

  function ensureRowState(ev: CategoryEventItem): RowState {
    const meta =
      ev.data && typeof ev.data === "object" && !Array.isArray(ev.data)
        ? (ev.data as Record<string, unknown>)
        : {};
    const note = typeof meta.note === "string" ? meta.note : "";
    return (
      rowById[ev.id] ?? {
        amount: formatValue(ev.amount),
        occurredAt: toLocalDatetimeInputValue(new Date(ev.occurredAt as any)),
        note,
        saving: false,
      }
    );
  }

  async function invalidateStats(): Promise<void> {
    const queryClient = await queryClientInitialized;
    await queryClient.invalidateQueries({ queryKey: ["operations/get-categories"] });
    await queryClient.invalidateQueries({ queryKey: ["operations/get-category-series"] });
    await queryClient.invalidateQueries({ queryKey: ["operations/get-category-line-series"] });
  }

  async function onSave(ev: CategoryEventItem) {
    const row = ensureRowState(ev);
    const amount = parseNumberInput(row.amount);
    if (amount == null) {
      window.alert("Enter a valid number.");
      return;
    }
    if (!row.occurredAt) {
      window.alert("Pick a date/time.");
      return;
    }
    setRowById((prev) => ({ ...prev, [ev.id]: { ...row, saving: true } }));
    try {
      const note = row.note.trim();
      await updateEvent({
        eventId: ev.id,
        amount,
        occurredAt: row.occurredAt,
        note: note ? note : null,
      });
      await invalidateStats();
    } finally {
      setRowById((prev) => ({ ...prev, [ev.id]: { ...prev[ev.id], saving: false } }));
    }
  }

  async function onDelete(ev: CategoryEventItem) {
    if (!window.confirm("Delete this entry?")) return;
    await deleteEvent({ eventId: ev.id });
    setExtraItems([]);
    setRowById((prev) => {
      const next = { ...prev };
      delete next[ev.id];
      return next;
    });
    await invalidateStats();
    await eventsQuery.refetch();
  }

  async function onLoadMore() {
    if (!items || items.length === 0) return;
    const last = items[items.length - 1];
    const before = new Date(last.occurredAt as any).toISOString();
    setLoadingMore(true);
    try {
      const next = await getCategoryEvents({ categoryId, take: 50, before });
      setExtraItems((prev) => [...prev, ...next]);
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
                  return (
                    <div
                      key={ev.id}
                      className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-[220px_140px_1fr_220px]"
                    >
                      <label className="flex flex-col gap-1">
                        <span className="label">Date & time</span>
                        <div className="h-10 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white">
                          <input
                            type="datetime-local"
                            value={row.occurredAt}
                            onChange={(e) =>
                              setRowById((prev) => ({
                                ...prev,
                                [ev.id]: { ...row, occurredAt: e.target.value },
                              }))
                            }
                            className="h-full w-full min-w-0 appearance-none bg-transparent px-3 text-neutral-900"
                            style={{ WebkitAppearance: "none" }}
                          />
                        </div>
                      </label>
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
                          className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="label">Note</span>
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) =>
                            setRowById((prev) => ({
                              ...prev,
                              [ev.id]: { ...row, note: e.target.value },
                            }))
                          }
                          className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500"
                          placeholder="Optional"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:justify-end">
                        <Button
                          className="h-10 w-full sm:w-auto"
                          onClick={() => onSave(ev)}
                          disabled={row.saving}
                        >
                          {row.saving ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          className="h-10 w-full sm:w-auto"
                          variant="danger"
                          onClick={() => onDelete(ev)}
                          disabled={row.saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                <Button variant="ghost" onClick={onLoadMore} disabled={loadingMore}>
                  Load more
                </Button>
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
