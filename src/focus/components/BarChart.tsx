import { useEffect, useMemo, useRef } from "react";
import type { SeriesBucket } from "../types";
import { goalLineColors } from "./goalColors";

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function BarChart({
  data,
  accentHex,
  goal,
  unit,
}: {
  data: SeriesBucket[];
  accentHex?: string;
  goal?: number | null;
  unit?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const resolvedGoal = goal != null && goal > 0 ? goal : null;
  const max = Math.max(1, ...data.map((d) => d.total), resolvedGoal ?? 1);
  const fill = accentHex ?? "#0a0a0a";
  const goalColors = goalLineColors(accentHex);
  const chartHeight = 120;
  const unitSuffix = unit && unit !== "x" ? ` ${unit}` : "";

  const minColPx = 32;
  const gapPx = 8;
  const endPadPx = 12;
  const minInnerWidth =
    data.length * minColPx + Math.max(0, data.length - 1) * gapPx + endPadPx;
  const gridColumns = `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`;

  const lastKey = useMemo(() => data.at(-1)?.startDate ?? "", [data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [lastKey]);

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
      >
        <div
          className="min-w-full"
          style={{ minWidth: `${minInnerWidth}px`, paddingRight: `${endPadPx}px` }}
        >
          <div className="grid items-end gap-2" style={{ gridTemplateColumns: gridColumns }}>
            {data.map((d) => (
              <div
                key={`v-${d.startDate}`}
                className="text-center text-[11px] font-semibold tabular-nums text-neutral-700"
              >
                {formatValue(d.total)}
              </div>
            ))}
          </div>

          <div className="relative mt-2" style={{ height: `${chartHeight}px` }}>
            {resolvedGoal != null
              ? (() => {
                  const goalPx = (resolvedGoal / max) * chartHeight;
                  const goalY = chartHeight - goalPx;
                  let labelY = goalY - 16;
                  if (labelY < 8) labelY = goalY + 8;
                  if (labelY > chartHeight - 16) labelY = Math.max(8, goalY - 16);

                  return (
                    <>
                      <div
                        className="pointer-events-none absolute left-0 right-0"
                        style={{
                          top: `${goalY}px`,
                          borderTop: `2px dashed ${goalColors.stroke}`,
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="pointer-events-none absolute left-2 text-[11px] font-semibold"
                        style={{ top: `${labelY}px`, color: goalColors.label }}
                        aria-hidden="true"
                      >
                        Goal {formatValue(resolvedGoal)}
                        {unitSuffix}
                      </div>
                    </>
                  );
                })()
              : null}

            <div
              className="grid h-full items-end gap-2"
              style={{ gridTemplateColumns: gridColumns }}
            >
              {data.map((d) => {
                const h = Math.round((d.total / max) * chartHeight);
                return (
                  <div key={d.startDate} className="flex items-end">
                    <div
                      title={`${formatValue(d.total)}`}
                      className="w-full rounded-lg"
                      style={{ height: `${h}px`, minHeight: "2px", backgroundColor: fill }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 grid items-end gap-2" style={{ gridTemplateColumns: gridColumns }}>
            {data.map((d) => (
              <div
                key={`l-${d.startDate}`}
                className="text-center text-[11px] font-medium text-neutral-500"
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
