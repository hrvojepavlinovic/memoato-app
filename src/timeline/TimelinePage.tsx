import { useEffect, useMemo, useState } from "react";
import { useQuery, getDayEvents } from "wasp/client/operations";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle, decryptEventNote } from "../privacy/decryptors";
import { isEncryptedString } from "../privacy/crypto";
import { Button } from "../shared/components/Button";
import { localGetCategoryEvents, localListCategories } from "../focus/local";

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

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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
  const privacy = usePrivacy();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedIso, setSelectedIso] = useState<string>(() => toIsoDate(new Date()));

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
          const iso = toIsoDate(new Date(ev.occurredOn as any));
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
      for (const ev of events) {
        const c = ev.category;
        if (!c) continue;
        map[c.id] = c.title.trim();
      }
      setTitleByCategoryId(map);
      setNoteByEventId({});
      return;
    }

    let cancelled = false;
    (async () => {
      const titleMap: Record<string, string> = {};
      const noteMap: Record<string, string> = {};

      if (!privacy.key) {
        for (const ev of events) {
          const c = ev.category;
          if (!c) continue;
          titleMap[c.id] = isEncryptedString(c.title) ? "Locked" : c.title.trim();
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

        const isNotes = (c.slug ?? "") === "notes";
        if (isNotes && ev.data) {
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
    const d = new Date(selectedIso);
    if (Number.isNaN(d.getTime())) return today;
    return startOfDay(d);
  }, [selectedIso, today]);

  const daysStrip = useMemo(() => {
    const base = day;
    return Array.from({ length: 9 }, (_, i) => addDays(base, i - 4));
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
      total: number;
      avg: number | null;
      notes: string[];
    }> = [];

    for (const [categoryId, evs] of groups.entries()) {
      const c = evs[0]?.category;
      if (!c) continue;
      const slug = c.slug ?? c.id;
      const isNotes = slug === "notes";
      const isWeight = c.chartType === "line" || c.categoryType === "GOAL";
      const count = evs.length;
      const total = evs.reduce((acc, e) => acc + (e.amount ?? 0), 0);
      const avg = isWeight && count > 0 ? total / count : null;
      const notes: string[] = [];
      if (isNotes) {
        for (const e of evs) {
          const n =
            noteByEventId[e.id] ??
            (typeof e.data?.note === "string" ? (e.data.note as string).trim() : "");
          if (n) notes.push(n);
        }
      }
      items.push({
        categoryId,
        title: titleByCategoryId[categoryId] ?? (isEncryptedString(c.title) ? "Locked" : c.title.trim()),
        emoji: c.emoji ?? null,
        accentHex: c.accentHex,
        unit: c.unit ?? null,
        slug,
        chartType: c.chartType ?? "bar",
        categoryType: c.categoryType,
        count,
        total,
        avg,
        notes,
      });
    }

    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [events, noteByEventId, titleByCategoryId]);

  const isToday = toIsoDate(day) === toIsoDate(today);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
          <p className="text-sm text-neutral-500">{isToday ? "Today" : formatDayLabel(day)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedIso(toIsoDate(addDays(day, -1)))}>
            ←
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIso(toIsoDate(addDays(day, 1)))}>
            →
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {daysStrip.map((d) => {
          const iso = toIsoDate(d);
          const active = iso === selectedIso;
          const label = iso === toIsoDate(today) ? "Today" : formatDayLabel(d);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedIso(iso)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${
                active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {privacy.mode !== "local" && serverQuery.isLoading ? (
        <div className="card p-4 text-sm text-neutral-500">Loading…</div>
      ) : summary.length === 0 ? (
        <div className="card p-4 text-sm text-neutral-500">Nothing logged for this day.</div>
      ) : (
        <div className="space-y-3">
          {summary.map((s) => {
            const unit = s.unit && s.unit !== "x" ? ` ${s.unit}` : "";
            const isNotes = s.slug === "notes";
            const isWeight = s.chartType === "line" || s.categoryType === "GOAL";

            let main = "";
            if (isNotes) {
              main = `${s.count} ${s.count === 1 ? "note" : "notes"}`;
            } else if (isWeight) {
              if (s.count <= 1) main = `Weighed`;
              else main = `Weighed ×${s.count}`;
            } else {
              main = `${Math.round(s.total * 100) / 100}${unit}`;
            }

            let sub: string | null = null;
            if (isWeight) {
              if (s.count === 1) sub = `${Math.round(s.total * 10) / 10}${unit || " kg"}`;
              else if (s.avg != null) sub = `avg ${Math.round(s.avg * 10) / 10}${unit || " kg"}`;
            }

            return (
              <div key={s.categoryId} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full border bg-white"
                        style={{ borderColor: s.accentHex }}
                        aria-hidden="true"
                      >
                        <div className="text-lg leading-none">{s.emoji ?? ""}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{s.title}</div>
                        <div className="text-sm text-neutral-500">{main}</div>
                      </div>
                    </div>
                  </div>
                  {sub ? <div className="shrink-0 text-sm font-semibold text-neutral-900">{sub}</div> : null}
                </div>

                {isNotes && s.notes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {s.notes.slice(0, 4).map((n, i) => (
                      <div key={`${s.categoryId}-${i}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                        {n}
                      </div>
                    ))}
                    {s.notes.length > 4 ? (
                      <div className="text-xs font-medium text-neutral-500">+{s.notes.length - 4} more</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
