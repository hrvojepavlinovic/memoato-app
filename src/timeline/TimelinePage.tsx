import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, getDayEvents } from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle, decryptEventNote } from "../privacy/decryptors";
import { isEncryptedString } from "../privacy/crypto";
import { Button } from "../shared/components/Button";
import { localGetCategoryEvents, localListCategories } from "../focus/local";
import { parseLocalIsoDate, startOfLocalDay, toLocalIsoDate, todayLocalIso } from "../shared/lib/localDate";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccentForTheme } from "../theme/colors";

type DayEvent = {
  id: string;
  amount: number | null;
  occurredAt: Date;
  occurredOn: Date;
  rawText: string | null;
  data: any | null;
  category: {
    id: string;
    title: string;
    slug: string | null;
    unit: string | null;
    categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
    chartType: "bar" | "line" | null;
    goalWeekly: number | null;
    goalValue: number | null;
    accentHex: string;
    emoji: string | null;
    isSystem: boolean;
  } | null;
};

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatDayLabel(d: Date): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const w = weekdays[d.getDay()] ?? "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${w} ${dd}.${mm}.`;
}

export function TimelinePage() {
  const navigate = useNavigate();
  const params = useParams<{ occurredOn?: string }>();
  const privacy = usePrivacy();
  const theme = useTheme();
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const todayIso = useMemo(() => todayLocalIso(), []);
  const [selectedIso, setSelectedIso] = useState<string>(() => {
    const s = params.occurredOn;
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return todayLocalIso();
  });

  useEffect(() => {
    const s = params.occurredOn;
    if (!s) {
      setSelectedIso(todayIso);
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      setSelectedIso(s);
      return;
    }
    navigate("/timeline", { replace: true });
    setSelectedIso(todayIso);
  }, [navigate, params.occurredOn, todayIso]);

  function selectIso(iso: string) {
    setSelectedIso(iso);
    if (iso === todayIso) {
      navigate("/timeline");
    } else {
      navigate(`/timeline/${iso}`);
    }
  }

  const serverQuery = useQuery(getDayEvents, { occurredOn: selectedIso } as any, {
    enabled: privacy.mode !== "local",
    retry: false,
  });

  const [localEvents, setLocalEvents] = useState<DayEvent[] | null>(null);
  const [titleByCategoryId, setTitleByCategoryId] = useState<Record<string, string>>({});
  const [noteByEventId, setNoteByEventId] = useState<Record<string, string>>({});

  // Load local-only day events.
  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    let cancelled = false;
    (async () => {
      const categories = await localListCategories(privacy.userId!);
      const catById = new Map(categories.map((c) => [c.id, c]));
      const onIso = selectedIso;
      const allEvents: any[] = [];
      // Local events are stored per-category; easiest is to scan all and filter by day.
      // local.ts doesn't export a day query, so we use listCategories + their events isn't efficient,
      // but local-only datasets are expected to be small.
      for (const c of categories) {
        const events = await localGetCategoryEvents({ userId: privacy.userId!, categoryId: c.id, take: 5000 });
        for (const ev of events) {
          const iso = toLocalIsoDate(new Date(ev.occurredOn as any));
          if (iso !== onIso) continue;
          allEvents.push({
            id: ev.id,
            amount: ev.amount,
            occurredAt: ev.occurredAt,
            occurredOn: ev.occurredOn,
            rawText: ev.rawText,
            data: ev.data,
            category: catById.get(c.id)
              ? {
                  id: c.id,
                  title: c.title,
                  slug: c.slug,
                  unit: c.unit,
                  categoryType: c.categoryType,
                  chartType: c.chartType,
                  goalWeekly: c.goalWeekly,
                  goalValue: c.goalValue,
                  accentHex: c.accentHex,
                  emoji: c.emoji,
                  isSystem: c.isSystem,
                }
              : null,
          } satisfies DayEvent);
        }
      }
      allEvents.sort((a, b) => (a.occurredAt as any) - (b.occurredAt as any));
      if (cancelled) return;
      setLocalEvents(allEvents);
    })();
    return () => {
      cancelled = true;
    };
  }, [privacy.mode, privacy.userId, selectedIso]);

  const events: DayEvent[] | null =
    privacy.mode === "local"
      ? localEvents
      : (serverQuery.data as any) ?? (serverQuery.isLoading ? null : []);

  // Decrypt titles/notes (best effort).
  useEffect(() => {
    if (!events) return;
    if (privacy.mode !== "encrypted") {
      // Still trim for display.
      const map: Record<string, string> = {};
      const noteMap: Record<string, string> = {};
      let cancelled = false;
      (async () => {
        for (const ev of events) {
          const c = ev.category;
          if (!c) continue;
          map[c.id] = String(c.title).trim();

          if (privacy.key && ev.data) {
            const note = await decryptEventNote(privacy.key, ev.data);
            if (note) noteMap[ev.id] = note;
            continue;
          }

          const note = typeof ev.data?.note === "string" ? (ev.data.note as string).trim() : "";
          if (note) noteMap[ev.id] = note;
        }
        if (cancelled) return;
        setTitleByCategoryId(map);
        setNoteByEventId(noteMap);
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    (async () => {
      const titleMap: Record<string, string> = {};
      const noteMap: Record<string, string> = {};

      if (!privacy.key) {
        for (const ev of events) {
          const c = ev.category;
          if (!c) continue;
          titleMap[c.id] = isEncryptedString(c.title) ? "Locked" : String(c.title).trim();
        }
        if (!cancelled) {
          setTitleByCategoryId(titleMap);
          setNoteByEventId(noteMap);
        }
        return;
      }

      for (const ev of events) {
        const c = ev.category;
        if (!c) continue;
        const t = await decryptCategoryTitle(privacy.key, c.title);
        titleMap[c.id] = t ?? "Locked";

        if (ev.data) {
          const note = await decryptEventNote(privacy.key, ev.data);
          if (note) noteMap[ev.id] = note;
        }
      }

      if (!cancelled) {
        setTitleByCategoryId(titleMap);
        setNoteByEventId(noteMap);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [events, privacy.mode, privacy.key]);

  const day = useMemo(() => {
    try {
      return parseLocalIsoDate(selectedIso);
    } catch {
      return today;
    }
  }, [selectedIso, today]);

  const daysStrip = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(day, i - 2));
  }, [day]);

  const summary = useMemo(() => {
    if (!events) return [];
    const groups = new Map<string, DayEvent[]>();
    for (const ev of events) {
      if (!ev.category?.id) continue;
      const arr = groups.get(ev.category.id) ?? [];
      arr.push(ev);
      groups.set(ev.category.id, arr);
    }

    const items: Array<{
      categoryId: string;
      title: string;
      emoji: string | null;
      accentHex: string;
      unit: string | null;
      slug: string;
      chartType: string;
      categoryType: string;
      count: number;
      firstAt: Date;
      lastAt: Date;
      total: number;
      avg: number | null;
      notePreview: string | null;
      notes: Array<{ occurredAt: Date; text: string }>;
    }> = [];

    for (const [categoryId, evs] of groups.entries()) {
      const c = evs[0]?.category;
      if (!c) continue;
      const slug = c.slug ?? c.id;
      const isNotes = slug === "notes";
      const isWeight = c.chartType === "line" || c.categoryType === "GOAL";
      const times = evs
        .map((e) => new Date(e.occurredAt as any))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      const firstAt = times[0] ?? new Date(day);
      const lastAt = times[times.length - 1] ?? new Date(day);
      const count = evs.length;
      const total = evs.reduce((acc, e) => acc + (e.amount ?? 0), 0);
      const avg = isWeight && count > 0 ? total / count : null;
      const notePreview =
        count === 1
          ? (noteByEventId[evs[0]!.id] ??
              (typeof evs[0]!.data?.note === "string" ? (evs[0]!.data.note as string).trim() : "") ??
              "") || null
          : null;
      const notes: Array<{ occurredAt: Date; text: string }> = [];
      if (isNotes) {
        for (const e of evs) {
          const occurredAt = new Date(e.occurredAt as any);
          const fromMap = noteByEventId[e.id];
          if (fromMap) {
            notes.push({ occurredAt, text: fromMap });
            continue;
          }
          const plain = typeof e.data?.note === "string" ? (e.data.note as string).trim() : "";
          if (plain) {
            notes.push({ occurredAt, text: plain });
            continue;
          }
          const enc = e.data && typeof e.data === "object" && !Array.isArray(e.data) ? (e.data as any).noteEnc : null;
          if (isEncryptedString(enc)) {
            notes.push({ occurredAt, text: "Locked note" });
          }
        }
      }
      notes.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      items.push({
        categoryId,
        title:
          titleByCategoryId[categoryId] ??
          (isEncryptedString(c.title) ? "Locked" : String(c.title).trim()),
        emoji: c.emoji ?? null,
        accentHex: c.accentHex,
        unit: c.unit ?? null,
        slug,
        chartType: c.chartType ?? "bar",
        categoryType: c.categoryType,
        count,
        firstAt,
        lastAt,
        total,
        avg,
        notePreview,
        notes,
      });
    }

    items.sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime());
    return items;
  }, [events, noteByEventId, titleByCategoryId]);

  const isToday = selectedIso === todayIso;

  function fmtTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function fmtMaybeTime(d: Date): string | null {
    if (Number.isNaN(d.getTime())) return null;
    return fmtTime(d);
  }

  function fmtRange(first: Date, last: Date): string | null {
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return null;
    const a = fmtTime(first);
    const b = fmtTime(last);
    return a === b ? a : `${a}–${b}`;
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{isToday ? "Today" : formatDayLabel(day)}</p>
        </div>
        {!isToday ? (
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={() => selectIso(todayIso)}>
              Today
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => selectIso(toLocalIsoDate(addDays(day, -1)))}>
            ←
          </Button>
          <div className="grid min-w-0 flex-1 grid-cols-5 gap-2">
            {daysStrip.map((d) => {
              const iso = toLocalIsoDate(d);
              const active = iso === selectedIso;
              const disabled = d.getTime() > today.getTime();
              const dd = String(d.getDate()).padStart(2, "0");
              const w = ["S", "M", "T", "W", "T", "F", "S"][d.getDay()] ?? "";
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectIso(iso)}
                  className={`flex min-w-0 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center ${
                    disabled
                      ? "border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500"
                      : active
                        ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950"
                        : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      active ? "text-white/70 dark:text-neutral-950/70" : "text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {w}
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{dd}</div>
                </button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isToday}
            onClick={() => selectIso(toLocalIsoDate(addDays(day, 1)))}
          >
            →
          </Button>
        </div>
      </div>

      {privacy.mode !== "local" && serverQuery.isLoading ? (
        <div className="card p-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</div>
      ) : summary.length === 0 ? (
        <div className="card p-4 text-sm text-neutral-500 dark:text-neutral-400">Nothing logged for this day.</div>
      ) : (
        <div className="relative space-y-1">
          <div className="absolute left-6 top-0 h-full w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
          {summary.map((s) => {
            const unit = s.unit && s.unit !== "x" ? ` ${s.unit}` : "";
            const isNotes = s.slug === "notes";
            const isWeight = s.chartType === "line" || s.categoryType === "GOAL";
            const accent = resolveAccentForTheme(s.accentHex, theme.isDark) ?? s.accentHex;

            let main = "";
            if (isNotes) {
              main = `${s.count} ${s.count === 1 ? "note" : "notes"}`;
            } else if (isWeight) {
              const kgUnit = unit || " kg";
              const v = Math.round(s.total * 10) / 10;
              if (s.count <= 1) main = `${v}${kgUnit}`;
              else if (s.avg != null) main = `avg ${Math.round(s.avg * 10) / 10}${kgUnit} · ×${s.count}`;
              else main = `×${s.count}`;
            } else {
              const total = Math.round(s.total * 100) / 100;
              if (s.count <= 1 && unit === "" && Math.abs(total - 1) < 1e-9 && s.notePreview) {
                main = s.notePreview;
              } else {
                main = s.count <= 1 ? `${total}${unit}` : `${total}${unit} total · ${s.count} entries`;
              }
            }

            let sub: string | null = null;
            if (isWeight) {
              sub = null;
            }

            const time = isNotes ? null : fmtRange(s.firstAt, s.lastAt);

            return (
              <Link
                key={s.categoryId}
                to={routes.CategoryRoute.to}
                params={{ categorySlug: s.slug }}
                className="group relative block rounded-xl px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="relative flex items-start gap-3">
                  <div
                    className="absolute left-0 top-2 flex h-8 w-8 items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                    style={{ borderColor: accent }}
                    aria-hidden="true"
                  >
                    <div className="text-lg leading-none">{s.emoji ?? ""}</div>
                  </div>
                  <div className="w-full pl-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{s.title}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-300">{main}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        {time ? <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{time}</div> : null}
                        {sub ? <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{sub}</div> : null}
                      </div>
                    </div>

                    {isNotes && s.notes.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {s.notes.slice(0, 3).map((n, i) => (
                          <div
                            key={`${s.categoryId}-${i}`}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                          >
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 tabular-nums text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                {fmtMaybeTime(n.occurredAt) ?? "—"}
                              </div>
                              <div className="min-w-0 whitespace-pre-wrap break-words">{n.text}</div>
                            </div>
                          </div>
                        ))}
                        {s.notes.length > 3 ? (
                          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">+{s.notes.length - 3} more</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
