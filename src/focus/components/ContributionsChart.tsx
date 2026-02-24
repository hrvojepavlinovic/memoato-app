import { useEffect, useMemo, useState } from "react";
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
}: {
  data: ContributionDay[];
  accentHex?: string;
}) {
  const theme = useTheme();
  const resolvedAccent = resolveAccentForTheme(accentHex ?? undefined, theme.isDark);
  const accent = resolvedAccent ?? (theme.isDark ? "#FAFAFA" : "#0A0A0A");
  const days = useMemo(() => data.slice().sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const maxCount = useMemo(() => Math.max(0, ...days.map((d) => d.count)), [days]);
  const weeks = useMemo(() => {
    const out: ContributionDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      out.push(days.slice(i, i + 7));
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

  function tileColor(count: number): string {
    if (count <= 0 || maxCount <= 0) return theme.isDark ? "#262626" : "#E5E7EB";
    const level = Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
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
          {active ? `${active.count} on ${formatDateLabel(active.date)}` : "No entries"}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
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
                  title={`${d.count} on ${formatDateLabel(d.date)}`}
                  aria-label={`${d.count} entries on ${formatDateLabel(d.date)}`}
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{ backgroundColor: tileColor(d.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => {
          const color =
            level === 0
              ? theme.isDark
                ? "#262626"
                : "#E5E7EB"
              : tileColor(Math.ceil((maxCount * level) / 4));
          return <span key={level} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />;
        })}
        <span>More</span>
      </div>
    </div>
  );
}
