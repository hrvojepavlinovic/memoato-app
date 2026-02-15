import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPublicUserCategoryLineSeries,
  getPublicUserCategorySeries,
  getPublicUserDashboard,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { BarChart } from "../focus/components/BarChart";
import { LineChart } from "../focus/components/LineChart";
import { PeriodPicker } from "../focus/components/PeriodPicker";
import type { BucketAggregation, CategoryWithStats, GoalDirection, Period } from "../focus/types";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccentForTheme } from "../theme/colors";
import { NotFoundPage } from "../NotFoundPage";
import { isEncryptedString } from "../privacy/crypto";

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function periodLabel(p: Period | null): string {
  if (p === "day") return "Today";
  if (p === "month") return "This month";
  if (p === "year") return "This year";
  return "This week";
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

function Summary({ category }: { category: CategoryWithStats }) {
  const theme = useTheme();
  const accent = resolveAccentForTheme(category.accentHex, theme.isDark) ?? category.accentHex;
  const unit = category.unit && category.unit !== "x" ? ` ${category.unit}` : "";

  if (category.chartType === "line") {
    const last = category.lastValue == null ? "n/a" : formatValue(category.lastValue);
    const goal = category.goalValue == null ? null : formatValue(category.goalValue);
    const dir = normalizeGoalDirection(category);
    const status =
      category.goalValue != null && category.lastValue != null
        ? goalDeltaLabel({ direction: dir, kind: "value", done: category.lastValue, goal: category.goalValue, unit })
        : null;
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        Last: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{last}{unit}</span>
        {goal ? (
          <>
            {" · "}Goal: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{goal}{unit}</span>
            {status ? (
              <>
                {" · "}{status}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  const goal = category.goalWeekly ?? 0;
  const done = category.thisWeekTotal;
  const pct = goal > 0 ? Math.min(1, Math.max(0, done / goal)) : 0;
  const label = periodLabel(category.period);

  if (goal > 0) {
    return (
      <div className="mt-1 w-full">
        <div className="flex items-center justify-between text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
          <span>{label}</span>
          <span className="tabular-nums">
            {formatValue(done)} / {formatValue(goal)}
            {unit}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: accent }} />
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-neutral-500 dark:text-neutral-400">
      {label}:{" "}
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
        {formatValue(done)}{unit}
      </span>
    </div>
  );
}

function BarCategoryChart({
  username,
  categoryId,
  period,
  offset,
  accentHex,
  goal,
  goalDirection,
  unit,
}: {
  username: string;
  categoryId: string;
  period: Period;
  offset: number;
  accentHex?: string;
  goal?: number | null;
  goalDirection?: any | null;
  unit?: string | null;
}) {
  const seriesQuery = useQuery(
    getPublicUserCategorySeries,
    { username, categoryId, period, offset },
    { retry: false },
  );

  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <BarChart data={seriesQuery.data} accentHex={accentHex} goal={goal} goalDirection={goalDirection} unit={unit} />;
}

function LineCategoryChart({
  username,
  categoryId,
  period,
  offset,
  goal,
  unit,
  accentHex,
  goalDirection,
}: {
  username: string;
  categoryId: string;
  period: Period;
  offset: number;
  goal: number | null;
  unit: string | null;
  accentHex?: string;
  goalDirection?: any | null;
}) {
  const seriesQuery = useQuery(
    getPublicUserCategoryLineSeries,
    { username, categoryId, period, offset },
    { retry: false },
  );

  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <LineChart data={seriesQuery.data} goal={goal} goalDirection={goalDirection} unit={unit} accentHex={accentHex} />;
}

export function PublicUserCategoryPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { username, categorySlug } = useParams<{ username: string; categorySlug: string }>();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState<number>(0);

  const dash = useQuery(getPublicUserDashboard, { username: username ?? "" }, { retry: false });
  const categories = dash.data?.categories ?? [];

  const category = useMemo(() => {
    if (!categorySlug) return null;
    return categories.find((c) => c.slug === categorySlug) ?? categories.find((c) => c.id === categorySlug) ?? null;
  }, [categories, categorySlug]);

  useEffect(() => {
    setOffset(0);
  }, [period]);

  if (dash.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
        <div className="h-7 w-56 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 h-28 rounded-xl bg-white dark:bg-neutral-950" />
      </div>
    );
  }

  if (!dash.isSuccess) {
    return <NotFoundPage />;
  }

  if (!category) {
    return <NotFoundPage />;
  }

  const resolvedTitle = isEncryptedString(category.title) ? "Private" : category.title;
  const accentHex = resolveAccentForTheme(category.accentHex, theme.isDark) ?? category.accentHex;
  const isLocked = isEncryptedString(category.title);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                style={{ borderColor: accentHex }}
                aria-hidden="true"
              >
                <div className="text-lg leading-none">{category.emoji ?? ""}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex w-full items-center justify-between gap-2">
                  <h2 className="truncate text-2xl font-semibold tracking-tight">
                    {resolvedTitle ?? "Category"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/u/${encodeURIComponent(dash.data.username)}`)}
                    className="h-10 sm:h-auto"
                  >
                    Back
                  </Button>
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  @{dash.data.username} · Read only
                </div>
              </div>
            </div>

            {!isLocked ? <Summary category={{ ...category, accentHex }} /> : null}
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            This category title is private.
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="sm:order-2">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:order-1 sm:flex sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOffset((v) => v - 1)}
            aria-label="Previous period"
            className="h-10 sm:h-auto"
          >
            ← Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOffset((v) => Math.min(0, v + 1))}
            aria-label="Next period"
            className="h-10 sm:h-auto"
            disabled={offset >= 0}
          >
            Next →
          </Button>
        </div>
      </div>

      <div className="card p-4">
        {category.chartType === "line" ? (
          <LineCategoryChart
            username={dash.data.username}
            categoryId={category.id}
            period={period}
            offset={offset}
            goal={category.goalValue ?? null}
            unit={category.unit ?? null}
            accentHex={accentHex}
            goalDirection={category.goalDirection}
          />
        ) : (
          <BarCategoryChart
            username={dash.data.username}
            categoryId={category.id}
            period={period}
            offset={offset}
            accentHex={accentHex}
            goal={category.goalWeekly ?? null}
            goalDirection={category.goalDirection}
            unit={category.unit ?? null}
          />
        )}
      </div>
    </div>
  );
}

