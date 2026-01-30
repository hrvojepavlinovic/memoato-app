import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createEvent,
  getCategories,
  getCategorySeries,
  getCategoryLineSeries,
  useQuery,
} from "wasp/client/operations";
import { routes } from "wasp/client/router";
import { Button, ButtonLink } from "../shared/components/Button";
import { BarChart } from "./components/BarChart";
import { HistoryList } from "./components/HistoryList";
import { LineChart } from "./components/LineChart";
import { PeriodPicker } from "./components/PeriodPicker";
import type { CategoryWithStats, Period } from "./types";
import { parseNumberInput } from "../shared/lib/parseNumberInput";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

function Summary({ category }: { category: CategoryWithStats }) {
  const unit =
    category.unit && category.unit !== "x"
      ? ` ${category.unit}`
      : "";

  if (category.chartType === "line") {
    const last = category.lastValue == null ? "—" : formatValue(category.lastValue);
    const goal = category.goalValue == null ? null : formatValue(category.goalValue);
    return (
      <div className="text-sm text-neutral-500">
        Last: <span className="font-semibold text-neutral-900">{last}{unit}</span>
        {goal ? (
          <>
            {" · "}Goal: <span className="font-semibold text-neutral-900">{goal}{unit}</span>
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
        <div className="flex items-center justify-between text-[12px] font-medium text-neutral-500">
          <span>{label}</span>
          <span className="tabular-nums">
            {formatValue(done)} / {formatValue(goal)}
            {unit}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct * 100}%`, backgroundColor: category.accentHex }}
            aria-label={`${label} progress`}
          />
        </div>
      </div>
    );
  }

  const week = formatValue(done);
  return (
    <div className="text-sm text-neutral-500">
      {label}:{" "}
      <span className="font-semibold text-neutral-900">
        {week}{unit}
      </span>
    </div>
  );
}

function BarCategoryChart({
  categoryId,
  period,
  offset,
  accentHex,
  goal,
  unit,
}: {
  categoryId: string;
  period: Period;
  offset: number;
  accentHex?: string;
  goal?: number | null;
  unit?: string | null;
}) {
  const seriesQuery = useQuery(getCategorySeries, { categoryId, period, offset });
  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <BarChart data={seriesQuery.data} accentHex={accentHex} goal={goal} unit={unit} />;
}

function LineCategoryChart({
  categoryId,
  period,
  offset,
  goal,
  unit,
  accentHex,
}: {
  categoryId: string;
  period: Period;
  offset: number;
  goal: number | null;
  unit: string | null;
  accentHex?: string;
}) {
  const seriesQuery = useQuery(getCategoryLineSeries, { categoryId, period, offset });
  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <LineChart data={seriesQuery.data} goal={goal} unit={unit} accentHex={accentHex} />;
}

export function CategoryPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState<string>(todayIso());

  const categoriesQuery = useQuery(getCategories);

  const category = useMemo(() => {
    if (!categorySlug || !categoriesQuery.data) return null;
    return (
      categoriesQuery.data.find((c) => c.slug === categorySlug) ??
      categoriesQuery.data.find((c) => c.id === categorySlug) ??
      null
    );
  }, [categoriesQuery.data, categorySlug]);

  useEffect(() => {
    if (!category || !categorySlug) return;
    if (categorySlug === category.id && category.slug) {
      navigate(`/c/${category.slug}`, { replace: true });
    }
  }, [category, categorySlug, navigate]);

  useEffect(() => {
    setOffset(0);
  }, [period]);

  async function onAdd() {
    const n = parseNumberInput(amount);
    if (n == null || n <= 0) {
      window.alert("Enter a positive number.");
      return;
    }
    if (!category?.id) return;
    await createEvent({ categoryId: category.id, amount: n, occurredOn });
    setAmount("");
  }

  const isWeight = category?.chartType === "line";
  const isCountType = category?.categoryType === "DO" || category?.categoryType === "DONT";
  const amountPlaceholder = isWeight ? "e.g. 84.5" : isCountType ? "e.g. 1" : "e.g. 20";
  const resolvedCategoryId = category?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-start gap-3">
              {category ? (
                <div
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white"
                  style={{ borderColor: category.accentHex }}
                  aria-hidden="true"
                >
                  <div className="text-lg leading-none">{category.emoji ?? ""}</div>
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex w-full items-center justify-between gap-2 sm:justify-start">
                  <h2 className="truncate text-2xl font-semibold tracking-tight">
                    {category?.title ?? "Category"}
                  </h2>
                  {category ? (
                    <ButtonLink
                      to={routes.EditCategoryRoute.to}
                      params={{ categorySlug: category.slug ?? category.id }}
                      variant="ghost"
                      size="sm"
                      className="sm:ml-1"
                    >
                      Edit
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            </div>

            {category ? <Summary category={category} /> : null}
          </div>
        </div>

        <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label">Date</span>
            <div className="h-10 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white">
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="h-full w-full min-w-0 appearance-none bg-transparent px-3 text-neutral-900"
                style={{ WebkitAppearance: "none" }}
              />
            </div>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label">Amount</span>
            <input
              type={isWeight ? "text" : "number"}
              step={isWeight ? undefined : "1"}
              inputMode={isWeight ? "decimal" : "numeric"}
              pattern={isWeight ? "[0-9]*[.,]?[0-9]*" : undefined}
              placeholder={amountPlaceholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500"
            />
          </label>
          <div className="flex min-w-0 items-end">
            <Button className="h-10 w-full" onClick={onAdd}>
              Add
            </Button>
          </div>
        </div>
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
            disabled={offset === 0}
            aria-label="Next period"
            className="h-10 sm:h-auto"
          >
            Next →
          </Button>
        </div>
      </div>

      {resolvedCategoryId && category ? (
        category.chartType === "line" ? (
          <LineCategoryChart
            key={`${resolvedCategoryId}-${period}-${offset}`}
            categoryId={resolvedCategoryId}
            period={period}
            offset={offset}
            goal={category.goalValue}
            unit={category.unit}
            accentHex={category.accentHex}
          />
	        ) : (
	          <BarCategoryChart
              key={`${resolvedCategoryId}-${period}-${offset}`}
	            categoryId={resolvedCategoryId}
	            period={period}
              offset={offset}
	            accentHex={category.accentHex}
	            goal={period === "week" ? category.goalWeekly : null}
	            unit={category.unit}
	          />
	        )
	      ) : null}

      {resolvedCategoryId && category ? (
        <HistoryList
          categoryId={resolvedCategoryId}
          step={isWeight ? 0.1 : 1}
          isDecimal={isWeight}
        />
      ) : null}
    </div>
  );
}
