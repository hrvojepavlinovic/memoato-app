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
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { encryptUtf8ToEncryptedString, isEncryptedString } from "../privacy/crypto";
import { localCreateEvent, localGetBarSeries, localGetCategoriesWithStats, localGetLineSeries } from "./local";

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function daysInYear(d: Date): number {
  const y = d.getFullYear();
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return isLeap ? 366 : 365;
}

function daysInPeriod(period: Period, reference: Date): number {
  if (period === "day") return 1;
  if (period === "week") return 7;
  if (period === "month") return daysInMonth(reference);
  return daysInYear(reference);
}

function periodReferenceDate(period: Period, offset: number): Date {
  const base = new Date();
  if (period === "day") {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return d;
  }
  if (period === "week") {
    const d = new Date(base);
    d.setDate(d.getDate() + offset * 7);
    return d;
  }
  if (period === "month") {
    return new Date(base.getFullYear(), base.getMonth() + offset, 1);
  }
  return new Date(base.getFullYear() + offset, 0, 1);
}

function scaleGoalToPeriod(args: {
  baseGoal: number | null;
  basePeriod: Period | null;
  viewPeriod: Period;
  viewOffset: number;
}): number | null {
  const { baseGoal, basePeriod, viewPeriod, viewOffset } = args;
  if (baseGoal == null || baseGoal <= 0) return null;
  const baseP: Period = basePeriod ?? "week";
  const ref = periodReferenceDate(viewPeriod, viewOffset);
  const baseDays = daysInPeriod(baseP, ref);
  const viewDays = daysInPeriod(viewPeriod, ref);
  if (baseDays <= 0 || viewDays <= 0) return baseGoal;
  const perDay = baseGoal / baseDays;
  const scaled = perDay * viewDays;
  return Math.max(0, Math.round(scaled));
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
  goalDirection,
  unit,
  isLocal,
  localUserId,
  bucketAggregation,
}: {
  categoryId: string;
  period: Period;
  offset: number;
  accentHex?: string;
  goal?: number | null;
  goalDirection?: any | null;
  unit?: string | null;
  isLocal: boolean;
  localUserId: string | null;
  bucketAggregation?: any | null;
}) {
  const seriesQuery = useQuery(getCategorySeries, { categoryId, period, offset }, { enabled: !isLocal });
  const [localData, setLocalData] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    if (!localUserId) return;
    let cancelled = false;
    localGetBarSeries({ userId: localUserId, categoryId, period, offset, aggregation: bucketAggregation }).then((d) => {
      if (!cancelled) setLocalData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketAggregation, categoryId, isLocal, localUserId, offset, period]);

  if (isLocal) {
    if (!localData) return <div className="h-[170px]" />;
    return <BarChart data={localData as any} accentHex={accentHex} goal={goal} goalDirection={goalDirection} unit={unit} />;
  }

  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <BarChart data={seriesQuery.data} accentHex={accentHex} goal={goal} goalDirection={goalDirection} unit={unit} />;
}

function LineCategoryChart({
  categoryId,
  period,
  offset,
  goal,
  unit,
  accentHex,
  goalDirection,
  isLocal,
  localUserId,
  bucketAggregation,
}: {
  categoryId: string;
  period: Period;
  offset: number;
  goal: number | null;
  unit: string | null;
  accentHex?: string;
  goalDirection?: any | null;
  isLocal: boolean;
  localUserId: string | null;
  bucketAggregation?: any | null;
}) {
  const seriesQuery = useQuery(getCategoryLineSeries, { categoryId, period, offset }, { enabled: !isLocal });
  const [localData, setLocalData] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    if (!localUserId) return;
    let cancelled = false;
    localGetLineSeries({ userId: localUserId, categoryId, period, offset, aggregation: bucketAggregation }).then((d) => {
      if (!cancelled) setLocalData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketAggregation, categoryId, isLocal, localUserId, offset, period]);

  if (isLocal) {
    if (!localData) return <div className="h-[170px]" />;
    return <LineChart data={localData as any} goal={goal} goalDirection={goalDirection} unit={unit} accentHex={accentHex} />;
  }

  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return <LineChart data={seriesQuery.data} goal={goal} goalDirection={goalDirection} unit={unit} accentHex={accentHex} />;
}

export function CategoryPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState<string>(todayIso());
  const [displayTitle, setDisplayTitle] = useState<string | null>(null);
  const privacy = usePrivacy();

  const categoriesQuery = useQuery(getCategories, undefined, { enabled: privacy.mode !== "local" });
  const [localCategories, setLocalCategories] = useState<CategoryWithStats[]>([]);
  const categories = privacy.mode === "local" ? localCategories : categoriesQuery.data ?? [];

  const category = useMemo(() => {
    if (!categorySlug) return null;
    return (
      categories.find((c) => c.slug === categorySlug) ??
      categories.find((c) => c.id === categorySlug) ??
      null
    );
  }, [categories, categorySlug]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    localGetCategoriesWithStats(privacy.userId).then((cats) => setLocalCategories(cats));
  }, [privacy.mode, privacy.userId]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    const userId = privacy.userId;
    if (!userId) return;
    const onChanged = (e: any) => {
      if (e?.detail?.userId !== userId) return;
      localGetCategoriesWithStats(userId).then((cats) => setLocalCategories(cats));
    };
    window.addEventListener("memoato:localChanged", onChanged);
    return () => window.removeEventListener("memoato:localChanged", onChanged);
  }, [privacy.mode, privacy.userId]);

  useEffect(() => {
    if (!category || !categorySlug) return;
    if (categorySlug === category.id && category.slug) {
      navigate(`/c/${category.slug}`, { replace: true });
    }
  }, [category, categorySlug, navigate]);

  useEffect(() => {
    let cancelled = false;
    setDisplayTitle(null);
    if (!category) return;
    if (!privacy.key) return;
    if (!isEncryptedString(category.title)) return;
    (async () => {
      const t = await decryptCategoryTitle(privacy.key as CryptoKey, category.title);
      if (cancelled) return;
      setDisplayTitle(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [category, privacy.key]);

  useEffect(() => {
    setOffset(0);
  }, [period]);

  async function onAdd() {
    if (!category?.id) return;
    const isNotes = (category.slug ?? "") === "notes";
    const n = isNotes ? 1 : parseNumberInput(amount);
    if (!isNotes && (n == null || n <= 0)) {
      window.alert("Enter a positive number.");
      return;
    }
    if (isNotes && note.trim().length === 0) {
      window.alert("Write a note first.");
      return;
    }
    if (privacy.mode === "local") {
      if (!privacy.userId) return;
      await localCreateEvent({
        userId: privacy.userId,
        categoryId: category.id,
        amount: n ?? 1,
        occurredOn,
        ...(isNotes ? { note } : {}),
      });
      setAmount("");
      setNote("");
      return;
    }
    if (isNotes && privacy.mode === "encrypted") {
      if (!privacy.key || !privacy.cryptoParams) {
        window.alert("Unlock encryption from Profile → Privacy first.");
        return;
      }
      const noteEnc = await encryptUtf8ToEncryptedString(privacy.key as CryptoKey, privacy.cryptoParams, note.trim());
      await createEvent({ categoryId: category.id, amount: 1, occurredOn, noteEnc } as any);
      setAmount("");
      setNote("");
      return;
    }
    await createEvent({ categoryId: category.id, amount: n ?? 1, occurredOn, ...(isNotes ? { note } : {}) } as any);
    setAmount("");
    setNote("");
  }

  const isWeight = category?.chartType === "line";
  const isNotes = (category?.slug ?? "") === "notes";
  const isCountType = category?.categoryType === "DO" || category?.categoryType === "DONT";
  const amountPlaceholder = isWeight ? "e.g. 84.5" : isCountType ? "e.g. 1" : "e.g. 20";
  const resolvedCategoryId = category?.id ?? null;
  const resolvedTitle =
    displayTitle ?? (category && isEncryptedString(category.title) ? "Locked" : category?.title ?? null);
  const isLocked = !!category && isEncryptedString(category.title) && !privacy.key;

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
                    {resolvedTitle ?? "Category"}
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

        {isLocked ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
            This category is encrypted. Unlock it from <span className="font-semibold">Profile → Privacy</span>.
          </div>
        ) : null}

        <div
          className={`card grid grid-cols-1 gap-3 p-4 ${
            isNotes ? "sm:grid-cols-[220px_1fr_140px]" : "sm:grid-cols-3"
          }`}
        >
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
          {isNotes ? (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a quick thought…"
                rows={2}
                className="block w-full min-w-0 max-w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
              />
            </label>
          ) : (
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
          )}
          <div className="flex min-w-0 items-end">
            <Button className="h-10 w-full" onClick={onAdd} disabled={isLocked}>
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
            goalDirection={category.goalDirection}
            unit={category.unit}
            accentHex={category.accentHex}
            isLocal={privacy.mode === "local"}
            localUserId={privacy.userId}
            bucketAggregation={category.bucketAggregation}
          />
        ) : (
          <BarCategoryChart
            key={`${resolvedCategoryId}-${period}-${offset}`}
            categoryId={resolvedCategoryId}
            period={period}
            offset={offset}
            accentHex={category.accentHex}
            goal={scaleGoalToPeriod({
              baseGoal: category.goalWeekly,
              basePeriod: category.period,
              viewPeriod: period,
              viewOffset: offset,
            })}
            goalDirection={category.goalDirection}
            unit={category.unit}
            isLocal={privacy.mode === "local"}
            localUserId={privacy.userId}
            bucketAggregation={category.bucketAggregation}
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
