import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createEvent,
  getCategories,
  getCategorySeries,
  getCategoryLineSeries,
  useQuery,
} from "wasp/client/operations";
import * as WaspOperations from "wasp/client/operations";
import { routes } from "wasp/client/router";
import { Button, ButtonLink } from "../shared/components/Button";
import { BarChart } from "./components/BarChart";
import { ContributionsChart } from "./components/ContributionsChart";
import { HistoryList } from "./components/HistoryList";
import { LineChart } from "./components/LineChart";
import { PeriodPicker } from "./components/PeriodPicker";
import type { BucketAggregation, CategoryWithStats, ContributionDay, Period } from "./types";
import { parseNumberInput } from "../shared/lib/parseNumberInput";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { encryptUtf8ToEncryptedString, isEncryptedString } from "../privacy/crypto";
import {
  localCreateEvent,
  localGetBarSeries,
  localGetContributionSeries,
  localGetCategoriesWithStats,
  localGetLineSeries,
} from "./local";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccentForTheme } from "../theme/colors";

const getCategoryContributions = (WaspOperations as any).getCategoryContributions;

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
  bucketAggregation?: BucketAggregation | null;
}): number | null {
  const { baseGoal, basePeriod, viewPeriod, viewOffset, bucketAggregation } = args;
  if (baseGoal == null || baseGoal <= 0) return null;
  if ((bucketAggregation ?? "").toLowerCase() === "avg") return baseGoal;
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
  const theme = useTheme();
  const accent = resolveAccentForTheme(category.accentHex, theme.isDark) ?? category.accentHex;
  const unit =
    category.unit && category.unit !== "x"
      ? ` ${category.unit}`
      : "";

  if (category.chartType === "line") {
    const last = category.lastValue == null ? "n/a" : formatValue(category.lastValue);
    const goal = category.goalValue == null ? null : formatValue(category.goalValue);
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        Last: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{last}{unit}</span>
        {goal ? (
          <>
            {" · "}Goal: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{goal}{unit}</span>
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
          <div
            className="h-full rounded-full"
            style={{ width: `${pct * 100}%`, backgroundColor: accent }}
            aria-label={`${label} progress`}
          />
        </div>
      </div>
    );
  }

  const week = formatValue(done);
  return (
    <div className="text-sm text-neutral-500 dark:text-neutral-400">
      {label}:{" "}
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
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

function ContributionCategoryChart({
  categoryId,
  categorySlug,
  unit,
  invertScale,
  accentHex,
  isLocal,
  localUserId,
}: {
  categoryId: string;
  categorySlug?: string | null;
  unit?: string | null;
  invertScale?: boolean;
  accentHex?: string;
  isLocal: boolean;
  localUserId: string | null;
}) {
  const seriesQuery = useQuery(getCategoryContributions as any, { categoryId }, { enabled: !isLocal });
  const [localData, setLocalData] = useState<ContributionDay[] | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    if (!localUserId) return;
    let cancelled = false;
    localGetContributionSeries({ userId: localUserId, categoryId }).then((d) => {
      if (!cancelled) setLocalData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId, isLocal, localUserId]);

  if (isLocal) {
    if (!localData) return <div className="h-[170px]" />;
    return (
      <ContributionsChart
        data={localData}
        accentHex={accentHex}
        unit={unit}
        isNotes={categorySlug === "notes"}
        invertScale={invertScale}
      />
    );
  }

  if (seriesQuery.isLoading) return <div className="h-[170px]" />;
  if (!seriesQuery.isSuccess) return <div className="text-red-600">Failed to load chart.</div>;
  return (
    <ContributionsChart
      data={seriesQuery.data as ContributionDay[]}
      accentHex={accentHex}
      unit={unit}
      isNotes={categorySlug === "notes"}
      invertScale={invertScale}
    />
  );
}

export function CategoryPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [scheduledStatus, setScheduledStatus] = useState<"went" | "missed" | "cancelled">("went");
  const [occurredOn, setOccurredOn] = useState<string>(todayIso());
  const [displayTitle, setDisplayTitle] = useState<string | null>(null);
  const privacy = usePrivacy();
  const theme = useTheme();
  const today = todayIso();

  function clampOccurredOn(next: string): string {
    if (!next) return today;
    return next > today ? today : next;
  }

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
    if (occurredOn > today) {
      window.alert("Future dates are not allowed.");
      setOccurredOn(today);
      return;
    }
    const isNotes = (category.slug ?? "") === "notes";
    const isSimpleTracking = category.categoryType === "DO" || category.categoryType === "DONT";
    const amountForSimple = scheduledStatus === "went" ? 1 : 0;
    const n = isNotes ? 1 : isSimpleTracking ? amountForSimple : parseNumberInput(amount);
    if (!isNotes && !isSimpleTracking && (n == null || n <= 0)) {
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
        rawText: isNotes ? note : isSimpleTracking ? `${category.title} ${scheduledStatus}` : amount.trim() || String(n ?? 1),
        ...(isNotes ? { note } : note.trim() ? { note } : {}),
        ...(isSimpleTracking ? { scheduledStatus } : {}),
      });
      setAmount("");
      setNote("");
      setScheduledStatus("went");
      return;
    }
    if (isNotes && privacy.mode === "encrypted") {
      if (!privacy.key || !privacy.cryptoParams) {
        window.alert("Unlock encryption from Profile → Privacy first.");
        return;
      }
      const noteEnc = await encryptUtf8ToEncryptedString(privacy.key as CryptoKey, privacy.cryptoParams, note.trim());
      await createEvent({ categoryId: category.id, amount: 1, occurredOn, noteEnc, rawText: null } as any);
      setAmount("");
      setNote("");
      setScheduledStatus("went");
      return;
    }
    await createEvent({
      categoryId: category.id,
      amount: n ?? 1,
      occurredOn,
      ...(isNotes ? { note } : note.trim() ? { note } : {}),
      ...(isSimpleTracking ? { scheduledStatus } : {}),
      ...(privacy.mode === "encrypted"
        ? {}
        : { rawText: isNotes ? note : isSimpleTracking ? `${category.title} ${scheduledStatus}` : amount.trim() || String(n ?? 1) }),
    } as any);
    setAmount("");
    setNote("");
    setScheduledStatus("went");
  }

  const isWeight = category?.chartType === "line";
  const isNotes = (category?.slug ?? "") === "notes";
  const isSimpleTracking = category?.categoryType === "DO" || category?.categoryType === "DONT";
  const isScheduledTracking = isSimpleTracking && category?.scheduleEnabled === true;
  const amountPlaceholder = isWeight ? "e.g. 84.5" : "e.g. 20";
  const resolvedCategoryId = category?.id ?? null;
  const resolvedTitle =
    displayTitle ?? (category && isEncryptedString(category.title) ? "Locked" : category?.title ?? null);
  const accentHex = category ? resolveAccentForTheme(category.accentHex, theme.isDark) ?? category.accentHex : "#0A0A0A";
  const isLocked = !!category && isEncryptedString(category.title) && !privacy.key;
  const activePrimaryView: "line" | "bar" = category?.chartType === "line" ? "line" : "bar";

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-start gap-3">
              {category ? (
                <div
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                  style={{ borderColor: accentHex }}
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
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            This category is encrypted. Unlock it from <span className="font-semibold">Profile → Privacy</span>.
          </div>
        ) : null}

        {isNotes ? (
          <div className="card grid grid-cols-1 gap-3 p-4">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a quick thought…"
                rows={3}
                className="block w-full min-w-0 max-w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="label">Date</span>
                <div className="h-10 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                  <input
                    type="date"
                    value={occurredOn}
                    max={today}
                    onChange={(e) => setOccurredOn(clampOccurredOn(e.target.value))}
                    className="h-full w-full min-w-0 appearance-none bg-transparent px-3 text-neutral-900 dark:text-neutral-100"
                    style={{ WebkitAppearance: "none" }}
                  />
                </div>
              </label>
              <div className="flex min-w-0 items-end">
                <Button className="h-10 w-full" onClick={onAdd} disabled={isLocked}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label">Date</span>
              <div className="h-10 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                <input
                  type="date"
                  value={occurredOn}
                  max={today}
                  onChange={(e) => setOccurredOn(clampOccurredOn(e.target.value))}
                  className="h-full w-full min-w-0 appearance-none bg-transparent px-3 text-neutral-900 dark:text-neutral-100"
                  style={{ WebkitAppearance: "none" }}
                />
              </div>
            </label>

            {isSimpleTracking ? (
              <div className="grid gap-3 sm:col-span-2">
                {isScheduledTracking ? (
                  <div>
                    <span className="label">Status</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {[
                        { value: "went", label: "Went" },
                        { value: "missed", label: "Didn’t go" },
                        { value: "cancelled", label: "Cancelled" },
                      ].map((opt) => {
                        const active = scheduledStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setScheduledStatus(opt.value as "went" | "missed" | "cancelled")}
                            className={
                              "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                              (active
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
                                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800")
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {category?.scheduleType || category?.scheduleTime ? (
                      <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        Scheduled {category.scheduleType === "daily" ? "daily" : "weekly"}
                        {category.scheduleTime ? ` at ${category.scheduleTime}` : ""}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <label className="flex min-w-0 flex-col gap-1">
                  <span className="label">Note (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={isScheduledTracking && scheduledStatus === "cancelled" ? "Why cancelled?" : "Any context"}
                    className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </label>
              </div>
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
                  className="block h-10 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </label>
            )}

            <div className={`flex min-w-0 items-end ${isSimpleTracking ? "sm:col-span-3 sm:justify-end" : ""}`}>
              <Button className={`h-10 ${isSimpleTracking ? "w-full sm:w-40" : "w-full"}`} onClick={onAdd} disabled={isLocked}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="sm:order-1">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:order-2 sm:flex sm:gap-2">
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
        activePrimaryView === "line" ? (
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
              bucketAggregation: category.bucketAggregation,
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
        <div className="mt-4">
          <ContributionCategoryChart
            key={`contrib-${resolvedCategoryId}`}
            categoryId={resolvedCategoryId}
            categorySlug={category.slug}
            unit={category.unit}
            invertScale={category.goalDirection === "at_most"}
            accentHex={category.accentHex}
            isLocal={privacy.mode === "local"}
            localUserId={privacy.userId}
          />
        </div>
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
