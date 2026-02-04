import { useEffect, useMemo, useRef, useState } from "react";
import type { LinePoint } from "../types";
import { goalLineColors } from "./goalColors";
import { useTheme } from "../../theme/ThemeProvider";
import { resolveAccentForTheme } from "../../theme/colors";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function LineChart({
  data,
  goal,
  goalDirection,
  unit,
  accentHex,
}: {
  data: LinePoint[];
  goal: number | null;
  goalDirection?: "at_least" | "at_most" | "target" | null;
  unit: string | null;
  accentHex?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const theme = useTheme();
  const resolvedAccent = resolveAccentForTheme(accentHex ?? undefined, theme.isDark);
  const stroke = resolvedAccent ?? (theme.isDark ? "#FAFAFA" : "#0a0a0a");
  const goalColors = goalLineColors(resolvedAccent ?? accentHex);
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  const hasValues = values.length > 0;

  const rawMin = hasValues ? Math.min(...values, goal ?? Infinity) : goal ?? 0;
  const rawMax = hasValues ? Math.max(...values, goal ?? -Infinity) : goal ?? 1;

  const finiteMin = Number.isFinite(rawMin) ? rawMin : 0;
  const finiteMax = Number.isFinite(rawMax) ? rawMax : finiteMin + 1;
  const baseSpan = finiteMax - finiteMin || 1;
  const margin = baseSpan * 0.08;
  const safeMin = finiteMin - margin;
  const safeMax = finiteMax + margin;
  const span = safeMax - safeMin || 1;

  const minWidthPerPoint = 44;
  const endPadPx = 12;
  const height = 140;
  const padTop = 12;
  const padBottom = 26;
  const usableHeight = height - padTop - padBottom;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const minWidth = Math.max(1, data.length) * minWidthPerPoint + endPadPx;
  const innerWidth = Math.max(minWidth, Math.max(0, containerWidth - 24)); // subtract p-3 left/right
  const usableWidth = Math.max(1, innerWidth - endPadPx);
  const stepX = usableWidth / Math.max(1, data.length);
  const lastKey = useMemo(() => data.at(-1)?.startDate ?? "", [data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    const threshold = 24;
    const atStart = el.scrollLeft <= threshold;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold;
    if (!atStart && !atEnd) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [lastKey]);

  function yFor(v: number): number {
    const t = (v - safeMin) / span;
    const y = padTop + (1 - t) * usableHeight;
    return clamp(y, padTop, padTop + usableHeight);
  }

  const points = data
    .map((d, idx) => {
      if (d.value == null) return null;
      const x = (idx + 0.5) * stepX;
      const y = yFor(d.value);
      return { x, y, value: d.value, label: d.label };
    })
    .filter((p): p is { x: number; y: number; value: number; label: string } => p != null);

  const path = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const goalY = goal == null ? null : yFor(goal);
  const unitSuffix = unit ? ` ${unit}` : "";
  const goalPrefix =
    goalDirection === "at_most" ? "≤" : goalDirection === "target" ? "≈" : "≥";

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        <svg width={innerWidth} height={height} className="block">
          {goalY != null && (
            <>
              <line
                x1={0}
                x2={innerWidth}
                y1={goalY}
                y2={goalY}
                stroke={goalColors.stroke}
                strokeDasharray="6 6"
              />
              <text
                x={8}
                y={goalY - 6 < 12 ? goalY + 14 : goalY - 6}
                fill={goalColors.label}
                fontSize="11"
                fontWeight={600}
              >
                Goal {goalPrefix} {formatValue(goal as number)}
                {unitSuffix}
              </text>
            </>
          )}

          {path && (
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((p) => (
            <g key={`${p.x}-${p.y}`}>
              <circle cx={p.x} cy={p.y} r={3.5} fill={stroke} />
              <text
                x={p.x}
                y={p.y - 8 < 12 ? p.y + 14 : p.y - 8}
                textAnchor="middle"
                fill="var(--chart-text)"
                fontSize="11"
                fontWeight={600}
              >
                {formatValue(p.value)}
              </text>
            </g>
          ))}

          {data.map((d, idx) => (
            <text
              key={`${d.startDate}-${idx}`}
              x={(idx + 0.5) * stepX}
              y={height - 8}
              textAnchor="middle"
              fill="var(--chart-muted)"
              fontSize="11"
              fontWeight={500}
            >
              {d.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
