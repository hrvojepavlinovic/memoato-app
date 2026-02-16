import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicUserDashboard, useQuery } from "wasp/client/operations";
import type { CategoryWithStats, GoalDirection } from "../focus/types";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccentForTheme } from "../theme/colors";
import { NotFoundPage } from "../NotFoundPage";
import { isEncryptedString } from "../privacy/crypto";

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function periodLabel(p: CategoryWithStats["period"]): string {
  if (p === "day") return "Today";
  if (p === "month") return "This month";
  if (p === "year") return "This year";
  return "This week";
}

function withHexAlpha(hex: unknown, alphaHex: string): string | null {
  if (typeof hex !== "string") return null;
  const h = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  if (!/^[0-9a-fA-F]{2}$/.test(alphaHex)) return null;
  return `${h}${alphaHex}`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function expectedPace01(period: CategoryWithStats["period"]): number {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  if (period === "day") {
    const ms = now.getTime() - startOfDay.getTime();
    return clamp01(ms / (24 * 60 * 60 * 1000));
  }

  if (period === "week") {
    const day = startOfDay.getDay(); // 0=Sun..6=Sat
    const diff = (day + 6) % 7; // Mon=0..Sun=6
    const start = new Date(startOfDay);
    start.setDate(startOfDay.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const ms = now.getTime() - start.getTime();
    return clamp01(ms / (end.getTime() - start.getTime()));
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ms = now.getTime() - start.getTime();
    return clamp01(ms / (end.getTime() - start.getTime()));
  }

  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const ms = now.getTime() - start.getTime();
  return clamp01(ms / (end.getTime() - start.getTime()));
}

function normalizeGoalDirection(c: CategoryWithStats): GoalDirection {
  const v = (c.goalDirection ?? "").toLowerCase();
  if (v === "at_most") return "at_most";
  if (v === "at_least") return "at_least";
  if (v === "target") return "target";
  if ((c.slug ?? "").toLowerCase() === "weight") return "at_most";
  if (c.categoryType === "DONT") return "at_most";
  return "at_least";
}

function goalDeltaLabel(args: {
  direction: GoalDirection;
  kind: "total" | "value";
  done: number;
  goal: number;
  unit?: string;
}): string {
  const { direction, kind, done, goal, unit = "" } = args;
  const delta = goal - done;

  if (direction === "target") {
    const diff = Math.abs(delta);
    const tol = Math.max(0.1, Math.abs(goal) * 0.01);
    return diff <= tol ? "on target" : `${formatValue(diff)}${unit} away`;
  }

  if (direction === "at_most") {
    if (done <= goal) {
      const remaining = Math.max(0, goal - done);
      return kind === "value" ? `${formatValue(remaining)}${unit} under goal` : `${formatValue(remaining)}${unit} left`;
    }
    return kind === "value" ? `${formatValue(done - goal)}${unit} to go` : `${formatValue(done - goal)}${unit} over`;
  }

  if (done >= goal) return "done";
  return `${formatValue(goal - done)}${unit} to go`;
}

function isGoalReached(c: CategoryWithStats): boolean {
  const dir = normalizeGoalDirection(c);
  if (c.chartType === "line") {
    if (c.goalValue == null || c.lastValue == null) return false;
    if (dir === "at_most") return c.lastValue <= c.goalValue;
    if (dir === "at_least") return c.lastValue >= c.goalValue;
    const tol = Math.max(0.1, Math.abs(c.goalValue) * 0.01);
    return Math.abs(c.lastValue - c.goalValue) <= tol;
  }
  if (c.goalWeekly == null || c.goalWeekly <= 0) return false;
  if (dir === "at_most") return c.thisWeekTotal <= c.goalWeekly;
  if (dir === "at_least") return c.thisWeekTotal >= c.goalWeekly;
  const tol = Math.max(1, Math.abs(c.goalWeekly) * 0.02);
  return Math.abs(c.thisWeekTotal - c.goalWeekly) <= tol;
}

function tileShowsDwyCounts(c: CategoryWithStats, displayTitle: string): boolean {
  const k = titleKey(displayTitle);
  if (k === "notes" || k === "padel" || k === "football") return true;
  return false;
}

function TileDwyCounts({ c, accent }: { c: CategoryWithStats; accent: string }) {
  return (
    <div className="grid grid-cols-3 items-end gap-3 text-center tabular-nums">
      <div>
        <div className="text-base font-semibold leading-none" style={{ color: accent }}>
          {c.todayCount ?? 0}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Today
        </div>
      </div>
      <div>
        <div className="text-base font-semibold leading-none" style={{ color: accent }}>
          {c.thisWeekCount ?? 0}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Week
        </div>
      </div>
      <div>
        <div className="text-base font-semibold leading-none" style={{ color: accent }}>
          {c.thisYearCount ?? 0}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Year
        </div>
      </div>
    </div>
  );
}

function tileGlance(c: CategoryWithStats, displayTitle: string): { value: string; label: string } {
  if (c.chartType === "line") {
    const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
    const last = c.lastValue == null ? "n/a" : `${formatValue(c.lastValue)}${unit}`;
    if (c.goalValue != null) {
      const dir = normalizeGoalDirection(c);
      if (c.lastValue != null) {
        return {
          value: last,
          label: goalDeltaLabel({ direction: dir, kind: "value", done: c.lastValue, goal: c.goalValue, unit }),
        };
      }
      return { value: last, label: `Goal ${formatValue(c.goalValue)}${unit}` };
    }
    return { value: last, label: "Latest" };
  }

  const isNotes = (c.slug ?? "").toLowerCase() === "notes";
  if (isNotes) {
    const n = c.thisWeekTotal ?? 0;
    const word = n === 1 ? "note" : "notes";
    return { value: `${formatValue(n)} ${word}`, label: periodLabel(c.period) };
  }

  const k = titleKey(displayTitle);
  if (k === "padel" || k === "football") {
    return { value: formatValue(c.thisYearTotal), label: "This year" };
  }
  return { value: formatValue(c.thisWeekTotal), label: periodLabel(c.period) };
}

function GoalProgress({ c }: { c: CategoryWithStats }) {
  const goal = c.goalWeekly ?? 0;
  const done = c.thisWeekTotal;
  const pct = goal > 0 ? Math.min(1, Math.max(0, done / goal)) : 0;
  const pace = goal > 0 ? expectedPace01(c.period) : 0;
  const paceLinePos = goal > 0 ? Math.min(0.98, Math.max(0.02, clamp01(pace))) : 0;

  return (
    <div className="mt-0">
      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
        <span>{periodLabel(c.period)}</span>
        <span className="tabular-nums">
          {formatValue(done)}/{formatValue(goal)}
          {c.unit && c.unit !== "x" ? ` ${c.unit}` : ""}
        </span>
      </div>
      <div className="relative mt-1 h-4">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          {pct > 0 ? (
            <div
              className={pct >= 0.999 ? "h-full rounded-full" : "h-full rounded-l-full"}
              style={{ width: `${pct * 100}%`, backgroundColor: c.accentHex }}
            />
          ) : null}
        </div>
        {goal > 0 ? (
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-[60%] rounded-full bg-neutral-200 dark:bg-neutral-800"
            style={{ left: `${paceLinePos * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}

export function PublicUserPage() {
  const { username } = useParams<{ username: string }>();
  const theme = useTheme();
  const q = useQuery(getPublicUserDashboard, { username: username ?? "" }, { retry: false });

  const categories = useMemo(() => q.data?.categories ?? [], [q.data?.categories]);

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
        <div className="h-7 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-white dark:bg-neutral-950" />
          ))}
        </div>
      </div>
    );
  }

  if (!q.isSuccess) {
    return <NotFoundPage />;
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Public dashboard
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">@{q.data.username}</div>
      </div>

      {categories.length === 0 ? (
        <div className="card p-4 text-sm text-neutral-600 dark:text-neutral-400">
          No public categories shared.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const rawTitle = isEncryptedString(c.title) ? "Private" : c.title;
            const displayTitle = rawTitle;
            const accent = resolveAccentForTheme(c.accentHex, theme.isDark) ?? c.accentHex;

            const goalReached = isGoalReached(c);
            const goalBg = goalReached ? withHexAlpha(accent, "08") : null;
            const unitChipRaw = (c.unit ?? "").trim();
            const unitChip = unitChipRaw && unitChipRaw !== "x" ? unitChipRaw : null;
            const glance = tileGlance(c, displayTitle);

            return (
              <div
                key={c.id}
                className="card relative z-0 flex min-h-24 flex-col justify-between gap-3 p-4 sm:min-h-28"
                style={{
                  borderColor: goalReached ? accent : undefined,
                  backgroundColor: goalBg ?? undefined,
                }}
              >
                <Link
                  to={`/u/${encodeURIComponent(q.data.username)}/c/${encodeURIComponent(c.slug)}`}
                  className="absolute inset-0 z-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
                  aria-label={`Open ${displayTitle}`}
                />

                <div className="relative flex items-start gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                      style={{ borderColor: accent }}
                      aria-hidden="true"
                    >
                      <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="min-w-0 truncate text-base font-semibold leading-tight text-neutral-950 dark:text-neutral-100"
                          title={displayTitle}
                        >
                          {displayTitle}
                        </div>
                        {unitChip ? (
                          <div className="inline-flex flex-none rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                            {unitChip}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {c.chartType !== "line" && c.goalWeekly != null && c.goalWeekly > 0 ? (
                  <div className="relative min-h-[46px] pt-1">
                    <GoalProgress c={{ ...c, accentHex: accent }} />
                  </div>
                ) : (
                  <div className="relative min-h-[46px] pt-1">
                    {tileShowsDwyCounts(c, displayTitle) ? (
                      <div className="pt-1">
                        <TileDwyCounts c={c} accent={accent} />
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <div className="min-w-0 flex-none text-lg font-semibold tabular-nums text-neutral-950 dark:text-neutral-100">
                          {glance.value}
                        </div>
                        <div
                          className="min-w-0 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400"
                          title={glance.label}
                        >
                          {glance.label}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
