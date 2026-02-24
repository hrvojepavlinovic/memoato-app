import { useMemo } from "react";
import type { SeriesBucket } from "../types";
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

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function DotChart({
  data,
  accentHex,
}: {
  data: SeriesBucket[];
  accentHex?: string;
}) {
  const theme = useTheme();
  const resolvedAccent = resolveAccentForTheme(accentHex ?? undefined, theme.isDark);
  const fill = resolvedAccent ?? (theme.isDark ? "#FAFAFA" : "#0A0A0A");
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.total)), [data]);

  const minColPx = 40;
  const gapPx = 8;
  const endPadPx = 12;
  const minInnerWidth =
    data.length * minColPx + Math.max(0, data.length - 1) * gapPx + endPadPx;
  const gridColumns = `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`;

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div
          className="min-w-full"
          style={{ minWidth: `${minInnerWidth}px`, paddingRight: `${endPadPx}px` }}
        >
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: gridColumns }}>
            {data.map((d) => {
              const ratio = Math.max(0, Math.min(1, d.total / max));
              const alpha = d.total <= 0 ? 0.08 : 0.2 + ratio * 0.8;
              return (
                <div key={d.startDate} className="flex flex-col items-center gap-1.5">
                  <div
                    className="h-3.5 w-3.5 rounded-full border"
                    style={{
                      backgroundColor: withAlpha(fill, alpha),
                      borderColor: withAlpha(fill, Math.max(alpha, 0.35)),
                    }}
                    title={`${d.label}: ${formatValue(d.total)}`}
                  />
                  <div className="text-center text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
