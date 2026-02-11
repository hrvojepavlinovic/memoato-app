import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link, routes } from "wasp/client/router";
import {
  ensureDefaultCategories,
  getCategories,
  getProfile,
  resetCategoryOrder,
  setCategoryOrder,
  useQuery,
} from "wasp/client/operations";
import type { CategoryWithStats } from "./types";
import { Button, ButtonLink } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { isEncryptedString } from "../privacy/crypto";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccentForTheme } from "../theme/colors";
import {
  localCreateCategory,
  localGetCategoriesWithStats,
  localResetCategoryOrder,
  localSetCategoryOrder,
} from "./local";
import type { BucketAggregation, GoalDirection } from "./types";
import { QuickLogDialog } from "./components/QuickLogDialog";

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

function GoalProgress({
  c,
  right = "status",
}: {
  c: CategoryWithStats;
  right?: "status" | "goal" | "fraction";
}) {
  const goal = c.goalWeekly ?? 0;
  const done = c.thisWeekTotal;
  const pct = goal > 0 ? Math.min(1, Math.max(0, done / goal)) : 0;
  const dir = normalizeGoalDirection(c);
  const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
  const status = goalDeltaLabel({ direction: dir, kind: "total", done, goal, unit });
  const rightLabel =
    right === "goal"
      ? `Goal ${formatValue(goal)}${unit}`
      : right === "fraction"
        ? `${formatValue(done)}/${formatValue(goal)}${unit}`
        : status;

  return (
    <div className="mt-0">
      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
        <span>{periodLabel(c.period)}</span>
        <span className="tabular-nums">{rightLabel}</span>
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
      return kind === "value"
        ? `${formatValue(remaining)}${unit} under goal`
        : `${formatValue(remaining)}${unit} left`;
    }
    return kind === "value"
      ? `${formatValue(done - goal)}${unit} to go`
      : `${formatValue(done - goal)}${unit} over`;
  }

  // at_least
  if (done >= goal) return "done";
  return `${formatValue(goal - done)}${unit} to go`;
}

function formatWeekGlance(c: CategoryWithStats, displayTitle: string): string {
  if (c.chartType === "line") {
    const last = c.lastValue == null ? "n/a" : formatValue(c.lastValue);
    const goal = c.goalValue == null ? null : formatValue(c.goalValue);
    const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
    const dir = normalizeGoalDirection(c);
    const status =
      c.goalValue != null && c.lastValue != null
        ? goalDeltaLabel({ direction: dir, kind: "value", done: c.lastValue, goal: c.goalValue, unit })
        : null;
    return goal ? `${last}${unit} · Goal ${goal}${unit}${status ? ` · ${status}` : ""}` : `${last}${unit}`;
  }

  if (c.goalWeekly != null && c.goalWeekly > 0) {
    return "";
  }

  const k = titleKey(displayTitle);
  if (k === "padel" || k === "football") {
    return `This year: ${formatValue(c.thisYearTotal)}`;
  }
  return `${periodLabel(c.period)}: ${formatValue(c.thisWeekTotal)}`;
}

function tileTypeChip(c: CategoryWithStats): string {
  const u = (c.unit ?? "").trim();
  if (u && u !== "x") return u;
  if ((c.slug ?? "").toLowerCase() === "notes") return "note";
  if (c.chartType === "line") return "value";
  if (c.categoryType === "DO" || c.categoryType === "DONT") return "count";
  return "total";
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

function coachSortScore(c: CategoryWithStats, nowMinute: number): number {
  const dir = normalizeGoalDirection(c);

  const title = (c.title ?? "").trim().toLowerCase();
  const slug = (c.slug ?? "").trim().toLowerCase();
  const unitRaw = (c.unit ?? "").trim().toLowerCase();
  const isWeight = slug === "weight" || title === "weight";
  const isKcal = unitRaw === "kcal" || unitRaw === "cal" || title.includes("kcal") || title.includes("calorie");

  const fallbackTypicalMinute = isWeight ? 9 * 60 : isKcal ? 20 * 60 : 12 * 60;
  const typicalMinute = c.recentAvgMinuteOfDay30d ?? fallbackTypicalMinute;
  const avgEventsPerDay = c.recentAvgEventsPerDay30d ?? 0;

  const minutesUntil = typicalMinute - nowMinute;
  const minutesPast = nowMinute - typicalMinute;
  const due =
    minutesPast >= 0
      ? Math.min(1, 0.65 + (Math.min(12 * 60, minutesPast) / (12 * 60)) * 0.35)
      : minutesUntil >= 6 * 60
        ? 0.15
        : 0.15 + (1 - Math.max(0, minutesUntil) / (6 * 60)) * 0.5;

  // If a category is often logged multiple times per day, time-of-day is less meaningful.
  const timeWeight = avgEventsPerDay >= 1.5 ? 0.5 : 1;

  function remainingPctTotal(done: number, goal: number): number {
    const denom = Math.max(1, Math.abs(goal));
    const diff =
      dir === "target" ? Math.abs(done - goal) : dir === "at_most" ? Math.max(0, done - goal) : Math.max(0, goal - done);
    return Math.min(2, diff / denom);
  }

  if (c.chartType === "line") {
    if (c.goalValue == null || c.lastValue == null) return 0;
    const denom = Math.max(1, Math.abs(c.goalValue));
    const diff =
      dir === "target"
        ? Math.abs(c.lastValue - c.goalValue)
        : dir === "at_most"
          ? Math.max(0, c.lastValue - c.goalValue)
          : Math.max(0, c.goalValue - c.lastValue);
    const remainingPct = Math.min(2, diff / denom);
    const boost = isWeight ? 0.2 : 0;
    return due * 100 * timeWeight + remainingPct * 20 + boost;
  }

  if (c.goalWeekly == null || c.goalWeekly <= 0) return 0;
  const remainingPct = remainingPctTotal(c.thisWeekTotal, c.goalWeekly);
  const boost = isKcal ? -0.1 : 0;
  return due * 100 * timeWeight + remainingPct * 20 + boost;
}

function CoachCard({
  categories,
  displayTitleById,
  themeIsDark,
  onQuickAdd,
  enabled,
}: {
  categories: CategoryWithStats[];
  displayTitleById: Record<string, string>;
  themeIsDark: boolean;
  onQuickAdd: (categoryId: string) => void;
  enabled: boolean;
}) {
  if (!enabled) return null;
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const coachCategories = categories
    .filter((c) => (c.goalWeekly != null && c.goalWeekly > 0) || c.goalValue != null)
    .filter((c) => {
      // For value-type categories (e.g. weight), suggesting after you've already logged today is annoying.
      if (c.chartType === "line" && (c.todayCount ?? 0) > 0) return false;
      return true;
    });
  if (coachCategories.length === 0) return null;

  const remaining = coachCategories.filter((c) => !isGoalReached(c));
  if (remaining.length === 0) {
    return (
      <div className="card mb-4 p-4">
        <div className="text-sm font-semibold text-neutral-950 dark:text-neutral-100">Next up</div>
        <div className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">You&apos;re on track.</div>
      </div>
    );
  }

  const ordered = remaining
    .slice()
    .sort((a, b) => {
      const sa = coachSortScore(a, nowMinute);
      const sb = coachSortScore(b, nowMinute);
      if (sa !== sb) return sb - sa;
      return (displayTitleById[a.id] ?? a.title).localeCompare(displayTitleById[b.id] ?? b.title);
    })
    .slice(0, 3);

  return (
    <div className="card mb-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-950 dark:text-neutral-100">Next up</div>
          <div className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Small wins stack up.
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {ordered.map((c) => {
          const displayTitle = displayTitleById[c.id] ?? c.title;
          const accent = resolveAccentForTheme(c.accentHex, themeIsDark) ?? c.accentHex;
          const dir = normalizeGoalDirection(c);
          const goalReached = isGoalReached(c);

          if (c.chartType === "line") {
            const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
            const status =
              c.goalValue != null && c.lastValue != null
                ? goalDeltaLabel({ direction: dir, kind: "value", done: c.lastValue, goal: c.goalValue, unit })
                : null;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                style={{ borderColor: goalReached ? accent : undefined }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                    style={{ borderColor: accent }}
                    aria-hidden="true"
                  >
                    <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">{displayTitle}</div>
                    <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {status ? status : "Goal set"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border bg-white text-neutral-950 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                  style={{ borderColor: accent }}
                  aria-label={`Quick add to ${displayTitle}`}
                  title="Quick add"
                  onClick={() => onQuickAdd(c.id)}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          }

          const goal = c.goalWeekly ?? 0;
          const donePeriod = c.thisWeekTotal ?? 0;
          const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
          const periodStatus = `${formatValue(donePeriod)}/${formatValue(goal)}${unit}`;

          return (
            <div
              key={c.id}
              className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
              style={{ borderColor: goalReached ? accent : undefined }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                    style={{ borderColor: accent }}
                    aria-hidden="true"
                  >
                    <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">{displayTitle}</div>
                    <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {periodStatus}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border bg-white text-neutral-950 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                  style={{ borderColor: accent }}
                  aria-label={`Quick add to ${displayTitle}`}
                  title="Quick add"
                  onClick={() => onQuickAdd(c.id)}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>

              <div className="mt-2">
                <GoalProgress c={c} right="fraction" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const privacy = usePrivacy();
  const theme = useTheme();
  const categoriesQuery = useQuery(getCategories, undefined, { enabled: privacy.mode !== "local" });
  const profileQuery = useQuery(getProfile, undefined, { enabled: privacy.mode !== "local" });
  const [localCategories, setLocalCategories] = useState<CategoryWithStats[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const categories = privacy.mode === "local" ? localCategories : (categoriesQuery.data ?? []);
  const isLoading = privacy.mode === "local" ? localLoading : categoriesQuery.isLoading;
  const isSuccess = privacy.mode === "local" ? true : categoriesQuery.isSuccess;
  const nextUpEnabled = privacy.mode === "local" ? false : (profileQuery.data?.nextUpEnabled ?? false);
  const quickLogFabSide = privacy.mode === "local" ? "right" : (profileQuery.data?.quickLogFabSide ?? "right");
  const ensuredOnceRef = useRef(false);
  const [titleById, setTitleById] = useState<Record<string, string>>({});
  const [orderMode, setOrderMode] = useState(false);
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogSeedCategoryId, setQuickLogSeedCategoryId] = useState<string | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const reorderItemByIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const onboardingDone = useMemo(() => {
    try {
      return localStorage.getItem("memoato:onboardingDone") === "1";
    } catch {
      return false;
    }
  }, []);

  const notesCategoryId = useMemo(() => {
    const notes = categories.find((c) => (c.slug ?? "").trim().toLowerCase() === "notes");
    return notes?.id ?? null;
  }, [categories]);

  useEffect(() => {
    if (privacy.mode === "local") return;
    if (!isSuccess) return;
    if (ensuredOnceRef.current) return;
    ensuredOnceRef.current = true;
    (async () => {
      await ensureDefaultCategories();
      await categoriesQuery.refetch();
    })();
  }, [categories, categoriesQuery, isSuccess]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    let cancelled = false;
    (async () => {
      setLocalLoading(true);
      try {
        let cats = await localGetCategoriesWithStats(privacy.userId!);
        if (cats.length === 0) {
          await localCreateCategory({
            userId: privacy.userId!,
            title: "Notes",
            categoryType: "NUMBER",
            chartType: "bar",
            bucketAggregation: "sum" satisfies BucketAggregation,
            goalDirection: "at_least" satisfies GoalDirection,
            period: "day",
            unit: null,
            goal: null,
            goalValue: null,
            accentHex: "#0A0A0A",
            emoji: "📝",
            slug: "notes",
            isSystem: true,
          });
          cats = await localGetCategoriesWithStats(privacy.userId!);
        }
        if (!cancelled) setLocalCategories(cats);
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    let cancelled = false;
    if (!privacy.key) {
      setTitleById({});
      return;
    }
    (async () => {
      const pairs = await Promise.all(
        categories.map(async (c) => {
          if (!isEncryptedString(c.title)) return [c.id, null] as const;
          const t = await decryptCategoryTitle(privacy.key as CryptoKey, c.title);
          return [c.id, t] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, t] of pairs) {
        if (t) next[id] = t;
      }
      setTitleById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categories, privacy.key]);

  useEffect(() => {
    if (!orderMode) return;
    if (draftOrderIds.length > 0) return;
    setDraftOrderIds(categories.map((c) => c.id));
  }, [orderMode, categories, draftOrderIds.length]);

  useEffect(() => {
    if (onboardingDone) return;
    if (orderMode) return;
    if (isLoading) return;
    if (!isSuccess) return;

    const hasNonSystem = categories.some((c) => !c.isSystem);
    if (!hasNonSystem) {
      navigate("/onboarding", { replace: true });
    }
  }, [categories, isLoading, isSuccess, navigate, onboardingDone, orderMode]);

  useEffect(() => {
    if (!orderMode) {
      setDraggingId(null);
      dragPointerIdRef.current = null;
    }
  }, [orderMode]);

  const displayTitleById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of categories) {
      const isEncrypted = isEncryptedString(c.title);
      out[c.id] = titleById[c.id] ?? (isEncrypted ? "Locked" : c.title);
    }
    return out;
  }, [categories, titleById]);

  function openQuickLog(seedCategoryId: string | null) {
    setQuickLogSeedCategoryId(seedCategoryId);
    setQuickLogOpen(true);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      if (quickLogOpen) return;
      if (orderMode) return;
      if (!window.matchMedia("(min-width: 640px)").matches) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || (target as any)?.isContentEditable) return;

      const key = (e.key ?? "").toLowerCase();
      if (key === "l") {
        e.preventDefault();
        setQuickLogSeedCategoryId(null);
        setQuickLogOpen(true);
        return;
      }
      if (key === "n") {
        if (!notesCategoryId) return;
        e.preventDefault();
        setQuickLogSeedCategoryId(notesCategoryId);
        setQuickLogOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notesCategoryId, orderMode, quickLogOpen]);

  if (isLoading) {
    return <div className="mx-auto w-full max-w-screen-lg px-4 py-6" />;
  }

  if (!isSuccess) {
    return <div className="px-4 py-8 text-red-600">Failed to load.</div>;
  }

  const orderedCategories: CategoryWithStats[] = orderMode
    ? draftOrderIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is CategoryWithStats => !!c)
    : categories;

  function moveId(list: string[], from: number, to: number): string[] {
    if (from === to) return list;
    if (from < 0 || to < 0) return list;
    if (from >= list.length || to >= list.length) return list;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    if (!item) return list;
    next.splice(to, 0, item);
    return next;
  }

  function setItemRef(id: string): (el: HTMLDivElement | null) => void {
    return (el) => {
      const map = reorderItemByIdRef.current;
      if (!el) map.delete(id);
      else map.set(id, el);
    };
  }

  function onDragHandlePointerDown(id: string, e: React.PointerEvent<HTMLButtonElement>): void {
    if (!orderMode) return;
    if (savingOrder) return;
    // Only left-click for mouse.
    if (e.pointerType === "mouse" && "button" in e && (e as any).button !== 0) return;

    dragPointerIdRef.current = e.pointerId;
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onDragHandlePointerMove(e: React.PointerEvent<HTMLButtonElement>): void {
    const pid = dragPointerIdRef.current;
    if (pid == null) return;
    if (e.pointerId !== pid) return;
    if (!draggingId) return;

    const items = Array.from(reorderItemByIdRef.current.entries())
      .map(([id, el]) => {
        const r = el.getBoundingClientRect();
        return { id, midY: r.top + r.height / 2 };
      })
      .sort((a, b) => a.midY - b.midY);

    if (items.length === 0) return;
    const y = e.clientY;
    let overId = items[0]!.id;
    let best = Math.abs(items[0]!.midY - y);
    for (const it of items) {
      const d = Math.abs(it.midY - y);
      if (d < best) {
        best = d;
        overId = it.id;
      }
    }

    if (overId === draggingId) return;
    setDraftOrderIds((prev) => {
      const from = prev.indexOf(draggingId);
      const to = prev.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      return moveId(prev, from, to);
    });
  }

  function onDragHandlePointerUp(e: React.PointerEvent<HTMLButtonElement>): void {
    const pid = dragPointerIdRef.current;
    if (pid == null) return;
    if (e.pointerId !== pid) return;
    dragPointerIdRef.current = null;
    setDraggingId(null);
  }

  async function saveOrder(): Promise<void> {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localSetCategoryOrder({ userId: privacy.userId!, orderedCategoryIds: draftOrderIds });
      } else {
        await setCategoryOrder({ orderedCategoryIds: draftOrderIds } as any);
        await categoriesQuery.refetch();
      }
      setOrderMode(false);
      setDraftOrderIds([]);
    } finally {
      setSavingOrder(false);
    }
  }

  async function doResetOrder(): Promise<void> {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localResetCategoryOrder({ userId: privacy.userId! });
      } else {
        await resetCategoryOrder();
        await categoriesQuery.refetch();
      }
      setOrderMode(false);
      setDraftOrderIds([]);
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 pt-6 pb-24 sm:pb-6">
      <div className="mb-5 hidden grid-cols-2 gap-3 sm:grid">
        <button
          type="button"
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
          onClick={() => openQuickLog(null)}
          aria-label="Quick log"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-neutral-950 dark:text-neutral-100">Log</div>
              <div className="mt-0.5 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Type and press Enter.
              </div>
            </div>
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
          onClick={() => openQuickLog(notesCategoryId)}
          aria-label="Quick note"
          disabled={!notesCategoryId}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-neutral-950 dark:text-neutral-100">Note</div>
              <div className="mt-0.5 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Write a quick note.
              </div>
            </div>
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      <CoachCard
        categories={orderedCategories}
        displayTitleById={displayTitleById}
        themeIsDark={theme.isDark}
        onQuickAdd={(id) => openQuickLog(id)}
        enabled={nextUpEnabled}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Categories</h2>
          <p className="text-sm text-neutral-500">
            {orderMode ? "Reorder categories." : "Tap to add and view history."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {orderMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                onClick={() => {
                  setOrderMode(false);
                  setDraftOrderIds([]);
                }}
                aria-label="Cancel reorder"
                title="Cancel"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                onClick={doResetOrder}
                disabled={savingOrder}
                aria-label="Reset to auto order"
                title="Reset"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 3v6h-6" />
                </svg>
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Button
                size="sm"
                className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                onClick={saveOrder}
                disabled={savingOrder}
                aria-label="Save order"
                title="Done"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="hidden sm:inline">Done</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3"
                onClick={() => setOrderMode(true)}
                aria-label="Edit order"
                title="Edit"
              >
                <span>Edit</span>
              </Button>
              <ButtonLink
                to="/categories/new"
                size="sm"
                className="h-10 px-3"
                aria-label="Add category"
                title="Add"
              >
                <span>Add</span>
              </ButtonLink>
            </>
          )}
        </div>
      </div>

      {orderMode ? (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-neutral-500">
            Drag the handle to reorder.
          </div>
          {orderedCategories.map((c) => {
            const displayTitle = displayTitleById[c.id] ?? c.title;
            const isDragging = draggingId === c.id;
            const accent = resolveAccentForTheme(c.accentHex, theme.isDark) ?? c.accentHex;
            return (
              <div
                key={c.id}
                ref={setItemRef(c.id)}
                className="card flex items-center justify-between gap-3 p-3"
                style={{
                  borderColor: isDragging ? accent : undefined,
                  backgroundColor: isDragging ? withHexAlpha(accent, "08") ?? undefined : undefined,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    className="touch-none select-none rounded-md bg-neutral-100 px-2 py-2 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    aria-label="Drag to reorder"
                    title="Drag"
                    onPointerDown={(e) => onDragHandlePointerDown(c.id, e)}
                    onPointerMove={onDragHandlePointerMove}
                    onPointerUp={onDragHandlePointerUp}
                    onPointerCancel={onDragHandlePointerUp}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M7 5h2v2H7V5Zm8 0h2v2h-2V5ZM7 11h2v2H7v-2Zm8 0h2v2h-2v-2ZM7 17h2v2H7v-2Zm8 0h2v2h-2v-2Z" />
                    </svg>
                  </button>

                  <div
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                    style={{ borderColor: accent }}
                    aria-hidden="true"
                  >
                    <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">{displayTitle}</div>
                    <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {formatWeekGlance(c, displayTitle)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedCategories.map((c) => {
              const displayTitle = displayTitleById[c.id] ?? c.title;
              const accent = resolveAccentForTheme(c.accentHex, theme.isDark) ?? c.accentHex;

	              const goalReached = isGoalReached(c);
	              const goalBg = goalReached ? withHexAlpha(accent, "08") : null;
	              const unitChipRaw = (c.unit ?? "").trim();
	              const unitChip = unitChipRaw && unitChipRaw !== "x" ? unitChipRaw : null;
	              const glance = tileGlance(c, displayTitle);

              return (
                <div
                  key={c.id}
                  className="card relative flex min-h-24 flex-col justify-between gap-3 p-4 sm:min-h-28"
                  style={{
                    borderColor: goalReached ? accent : undefined,
                    backgroundColor: goalBg ?? undefined,
                  }}
                >
                  <Link
                    to={routes.CategoryRoute.to}
                    params={{ categorySlug: c.slug }}
                    className="absolute inset-0 z-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20"
                    aria-label={`Open ${displayTitle}`}
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                        style={{ borderColor: accent }}
                        aria-hidden="true"
                      >
                        <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                      </div>
	                      <div className="min-w-0">
	                        <div className="flex items-center gap-2 pr-10">
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

                    <button
                      type="button"
                      className="relative z-20 inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border bg-white text-neutral-950 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                      style={{ borderColor: accent }}
                      aria-label={`Quick add to ${displayTitle}`}
                      title="Quick add"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openQuickLog(c.id);
                      }}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                  </div>

                  {c.chartType !== "line" && c.goalWeekly != null && c.goalWeekly > 0 ? (
                    <div className="relative min-h-[46px] pt-1">
                      <GoalProgress c={c} right="fraction" />
                    </div>
                  ) : (
                    <div className="relative min-h-[46px] pt-1">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <QuickLogDialog
            open={quickLogOpen}
            onClose={() => {
              setQuickLogOpen(false);
              setQuickLogSeedCategoryId(null);
            }}
            categories={orderedCategories}
            displayTitleById={displayTitleById}
            seedCategoryId={quickLogSeedCategoryId}
          />
        </>
      )}

      {!orderMode && !quickLogOpen ? (
        <div
          className={[
            "fixed top-[calc(50%+30px)] z-40 -translate-y-1/2 sm:hidden",
            quickLogFabSide === "left" ? "left-4" : "right-4",
          ].join(" ")}
        >
          <div className="rounded-3xl bg-neutral-950/10 p-3 backdrop-blur-lg ring-1 ring-neutral-950/10 dark:bg-neutral-950/35 dark:ring-white/10">
            <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-10 rounded-full bg-neutral-950/10 opacity-70 blur-2xl dark:bg-white/10"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => openQuickLog(null)}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg hover:bg-neutral-900 active:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 dark:active:bg-neutral-300"
                aria-label="Quick log"
                title="Log"
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-9 rounded-full bg-neutral-950/10 opacity-70 blur-2xl dark:bg-white/10"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => openQuickLog(notesCategoryId)}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                aria-label="Quick note"
                title="Note"
                disabled={!notesCategoryId}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
