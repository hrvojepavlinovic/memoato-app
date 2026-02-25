import { useEffect, useMemo, useRef, useState } from "react";
import type { ContributionDay } from "../types";
import { useTheme } from "../../theme/ThemeProvider";
import { resolveAccentForTheme } from "../../theme/colors";

function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  const n = Math.round(clamped * 255);
  const suffix = n.toString(16).padStart(2, "0");
  return `${hex}${suffix}`;
}

function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - mondayIndex(x));
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatDateLabel(iso: string): string {
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function ContributionsChart({
  data,
  accentHex,
  unit,
  isNotes,
  invertScale,
}: {
  data: ContributionDay[];
  accentHex?: string;
  unit?: string | null;
  isNotes?: boolean;
  invertScale?: boolean;
}) {
  const theme = useTheme();
  const resolvedAccent = resolveAccentForTheme(accentHex ?? undefined, theme.isDark);
  const accent = resolvedAccent ?? (theme.isDark ? "#FAFAFA" : "#0A0A0A");
  const days = useMemo(() => data.slice().sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const maxValue = useMemo(() => Math.max(0, ...days.map((d) => (d.value > 0 ? d.value : 0))), [days]);
  const minPositiveValue = useMemo(() => {
    const values = days.map((d) => d.value).filter((v) => v > 0);
    if (values.length === 0) return 0;
    return Math.min(...values);
  }, [days]);
  const weeks = useMemo(() => {
    const out: ContributionDay[][] = [];
    if (days.length === 0) return out;

    const byDate = new Map(days.map((d) => [d.date, d] as const));
    const firstDate = parseIsoDate(days[0]!.date);
    const lastDate = parseIsoDate(days[days.length - 1]!.date);
    if (Number.isNaN(firstDate.getTime()) || Number.isNaN(lastDate.getTime())) return out;

    const firstWeekStart = startOfWeekMonday(firstDate);
    const lastTime = lastDate.getTime();
    const firstTime = firstDate.getTime();

    for (let weekStart = firstWeekStart; weekStart.getTime() <= lastTime; weekStart = addDays(weekStart, 7)) {
      const week: ContributionDay[] = [];
      for (let i = 0; i < 7; i += 1) {
        const day = addDays(weekStart, i);
        const t = day.getTime();
        if (t < firstTime || t > lastTime) continue;
        const iso = toIsoDate(day);
        week.push(byDate.get(iso) ?? { date: iso, value: 0 });
      }
      if (week.length > 0) out.push(week);
    }

    return out;
  }, [days]);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    if (days.length === 0) {
      setActiveDate(null);
      return;
    }
    setActiveDate(days[days.length - 1]!.date);
  }, [days]);

  const active = useMemo(
    () => (activeDate ? days.find((d) => d.date === activeDate) : null) ?? days[days.length - 1] ?? null,
    [activeDate, days],
  );
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollWrapRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  }, [days]);

  function formatValue(value: number): string {
    if (!Number.isFinite(value)) return "0";
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return value.toFixed(1);
  }

  function valueLabel(value: number): string {
    if (isNotes) {
      const rounded = Math.max(0, Math.round(value));
      return rounded === 1 ? "1 note" : `${rounded} notes`;
    }
    const formatted = formatValue(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  function tileColor(value: number): string {
    const normalizedValue = value > 0 ? value : 0;
    if (normalizedValue <= 0 || maxValue <= 0) return theme.isDark ? "#262626" : "#E5E7EB";
    let level = Math.min(4, Math.max(1, Math.ceil((normalizedValue / maxValue) * 4)));
    if (invertScale) {
      if (maxValue > minPositiveValue) {
        const ratio = (maxValue - normalizedValue) / (maxValue - minPositiveValue);
        level = Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
      } else {
        level = 4;
      }
    }
    if (level === 1) return withAlpha(accent, 0.24);
    if (level === 2) return withAlpha(accent, 0.4);
    if (level === 3) return withAlpha(accent, 0.58);
    return withAlpha(accent, 0.78);
  }

  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Contributions</div>
        <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {active ? `${valueLabel(active.value)} on ${formatDateLabel(active.date)}` : "No entries"}
        </div>
      </div>

      <div ref={scrollWrapRef} className="mt-3 overflow-x-auto pb-1">
        <div className="inline-flex gap-[3px]">
          {weeks.map((week, weekIdx) => (
            <div key={`week-${weekIdx}`} className="grid grid-rows-7 gap-[3px]">
              {week.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onMouseEnter={() => setActiveDate(d.date)}
                  onFocus={() => setActiveDate(d.date)}
                  onClick={() => setActiveDate(d.date)}
                  title={`${valueLabel(d.value)} on ${formatDateLabel(d.date)}`}
                  aria-label={`${valueLabel(d.value)} on ${formatDateLabel(d.date)}`}
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{ backgroundColor: tileColor(d.value) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
