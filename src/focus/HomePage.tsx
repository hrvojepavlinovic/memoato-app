import { useEffect, useRef } from "react";
import { Link, routes } from "wasp/client/router";
import { ensureDefaultCategories, getCategories, useQuery } from "wasp/client/operations";
import type { CategoryWithStats } from "./types";
import { ButtonLink } from "../shared/components/Button";

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

function withHexAlpha(hex: string, alphaHex: string): string | null {
  const h = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  if (!/^[0-9a-fA-F]{2}$/.test(alphaHex)) return null;
  return `${h}${alphaHex}`;
}

function GoalProgress({ c }: { c: CategoryWithStats }) {
  const goal = c.goalWeekly ?? 0;
  const done = c.thisWeekTotal;
  const pct = goal > 0 ? Math.min(1, Math.max(0, done / goal)) : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
        <span>{periodLabel(c.period)}</span>
        <span className="tabular-nums">
          {formatValue(done)} / {formatValue(goal)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, backgroundColor: c.accentHex }}
          aria-label={`${periodLabel(c.period)} progress`}
        />
      </div>
    </div>
  );
}

function formatWeekGlance(c: CategoryWithStats): string {
  if (c.chartType === "line") {
    const last = c.lastValue == null ? "—" : formatValue(c.lastValue);
    const goal = c.goalValue == null ? null : formatValue(c.goalValue);
    const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
    return goal ? `${last}${unit} · Goal: ${goal}${unit}` : `${last}${unit}`;
  }

  if (c.goalWeekly != null && c.goalWeekly > 0) {
    return "";
  }

  const k = titleKey(c.title);
  if (k === "padel" || k === "football") {
    return `This year: ${formatValue(c.thisYearTotal)}`;
  }
  return `${periodLabel(c.period)}: ${formatValue(c.thisWeekTotal)}`;
}

export function HomePage() {
  const categoriesQuery = useQuery(getCategories);
  const categories = categoriesQuery.data ?? [];
  const isLoading = categoriesQuery.isLoading;
  const isSuccess = categoriesQuery.isSuccess;
  const ensuredOnceRef = useRef(false);

  useEffect(() => {
    if (!isSuccess) return;
    if (ensuredOnceRef.current) return;
    ensuredOnceRef.current = true;
    (async () => {
      await ensureDefaultCategories();
      await categoriesQuery.refetch();
    })();
  }, [categories, categoriesQuery, isSuccess]);

  if (isLoading) {
    return <div className="mx-auto w-full max-w-screen-lg px-4 py-6" />;
  }

  if (!isSuccess) {
    return <div className="px-4 py-8 text-red-600">Failed to load.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Categories</h2>
          <p className="text-sm text-neutral-500">Tap to add and view history.</p>
        </div>
        <ButtonLink to="/categories/new">Add category</ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((c) => {
          const goalReached =
            c.chartType === "line"
              ? c.goalValue != null && c.lastValue != null && c.lastValue <= c.goalValue
              : c.goalWeekly != null && c.goalWeekly > 0 && c.thisWeekTotal >= c.goalWeekly;

          const goalBg = goalReached ? withHexAlpha(c.accentHex, "08") : null;

          return (
            <Link
              key={c.id}
              to={routes.CategoryRoute.to}
              params={{ categorySlug: c.slug }}
              className="card flex min-h-20 flex-col justify-between p-4 active:scale-[0.99]"
              style={{
                borderColor: goalReached ? c.accentHex : undefined,
                backgroundColor: goalBg ?? undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-base font-semibold">{c.title}</div>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border bg-white"
                  style={{ borderColor: c.accentHex }}
                  aria-hidden="true"
                >
                  <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                </div>
              </div>
              {c.chartType !== "line" && c.goalWeekly != null && c.goalWeekly > 0 ? (
                <GoalProgress c={c} />
              ) : (
                <div className="mt-2 text-xs font-medium text-neutral-500">
                  {formatWeekGlance(c)}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
