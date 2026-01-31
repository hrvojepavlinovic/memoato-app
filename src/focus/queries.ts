import { Category } from "wasp/entities";
import { HttpError } from "wasp/server";
import {
  type GetCategories,
  type GetCategorySeries,
  type GetCategoryLineSeries,
  type GetCategoryEvents,
} from "wasp/server/operations";
import type {
  CategoryChartType,
  CategoryEventItem,
  CategoryWithStats,
  LinePoint,
  Period,
  SeriesBucket,
} from "./types";

function slugifyTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return s.length > 0 ? s : "category";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday start
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function startOfYear(d: Date): Date {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}

export const getCategories: GetCategories<void, CategoryWithStats[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;
  const categories: any[] = await (context.entities.Category as any).findMany({
    where: {
      userId,
      sourceArchivedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      period: true,
      unit: true,
      chartType: true,
      categoryType: true,
      accentHex: true,
      emoji: true,
      isSystem: true,
      goalWeekly: true,
      goalValue: true,
    },
    orderBy: [{ title: "asc" }],
  });

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yearStart = startOfYear(now);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

  const categoryIds = categories.map((c) => String(c.id));
  async function totalsForWindow(start: Date, end: Date): Promise<Map<string, number>> {
    const totals = await context.entities.Event.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        kind: "SESSION",
        categoryId: { in: categoryIds },
        occurredAt: { gte: start, lt: end },
        amount: { not: null },
      },
      _sum: { amount: true },
    });
    const m = new Map<string, number>();
    for (const t of totals) {
      if (!t.categoryId) continue;
      m.set(t.categoryId, t._sum.amount ?? 0);
    }
    return m;
  }

  const [dayTotals, weekTotals, monthTotals, yearTotals] = await Promise.all([
    totalsForWindow(dayStart, dayEnd),
    totalsForWindow(weekStart, weekEnd),
    totalsForWindow(monthStart, monthEnd),
    totalsForWindow(yearStart, yearEnd),
  ]);

  const lastOccurredAtByCategory = new Map<string, Date>();
  if (categoryIds.length > 0) {
    const lastOccurred = await context.entities.Event.groupBy({
      by: ["categoryId"],
      where: { userId, kind: "SESSION", categoryId: { in: categoryIds } },
      _max: { occurredAt: true },
    });
    for (const row of lastOccurred) {
      if (!row.categoryId) continue;
      if (!row._max.occurredAt) continue;
      lastOccurredAtByCategory.set(row.categoryId, row._max.occurredAt);
    }
  }

  const lastByCategory = new Map<string, number>();
  const lineCategoryIds = categories
    .filter((c) => (c.chartType ?? "bar") === "line")
    .map((c) => c.id);
  if (lineCategoryIds.length > 0) {
    const lastEvents = await context.entities.Event.findMany({
      where: {
        userId,
        kind: "SESSION",
        categoryId: { in: lineCategoryIds },
        amount: { not: null },
      },
      select: { categoryId: true, amount: true, occurredAt: true },
      orderBy: [{ occurredAt: "desc" }],
      take: 500,
    });
    for (const ev of lastEvents) {
      if (!ev.categoryId) continue;
      if (lastByCategory.has(ev.categoryId)) continue;
      if (ev.amount == null) continue;
      lastByCategory.set(ev.categoryId, ev.amount);
    }
  }

  const usedSlugs = new Set<string>();
  const resolvedSlugById = new Map<string, string>();
  for (const c of categories) {
    const base = slugifyTitle(c.slug ?? c.title);
    let candidate = base;
    let n = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    usedSlugs.add(candidate);
    resolvedSlugById.set(c.id, candidate);
  }

  const result = categories.map((c) => ({
    id: c.id,
    title: c.title,
    slug: resolvedSlugById.get(c.id) ?? slugifyTitle(c.title),
    unit: c.unit ?? null,
    chartType: ((c.chartType ?? "bar") as CategoryChartType),
    categoryType: c.categoryType,
    accentHex: c.accentHex,
    emoji: c.emoji ?? null,
    isSystem: !!c.isSystem,
    period: (c.period as Period | null) ?? null,
    goalWeekly: c.goalWeekly ?? null,
    goalValue: c.goalValue ?? null,
    thisWeekTotal:
      (c.period === "day"
        ? dayTotals.get(c.id)
        : c.period === "month"
          ? monthTotals.get(c.id)
          : c.period === "year"
            ? yearTotals.get(c.id)
            : weekTotals.get(c.id)) ?? 0,
    thisYearTotal: yearTotals.get(c.id) ?? 0,
    lastValue: lastByCategory.get(c.id) ?? null,
  }));

  function sortRank(c: CategoryWithStats): number {
    if (c.chartType === "line") return 2; // goal-value series (e.g. weight)
    if (c.goalWeekly != null && c.goalWeekly > 0) return 0; // progress-bar categories
    return 1; // simple tracking categories (no goal)
  }

  function isGoalReached(c: CategoryWithStats): boolean {
    if (c.chartType === "line") {
      return c.goalValue != null && c.lastValue != null && c.lastValue <= c.goalValue;
    }
    return c.goalWeekly != null && c.goalWeekly > 0 && c.thisWeekTotal >= c.goalWeekly;
  }

  result.sort((a, b) => {
    const ga = isGoalReached(a);
    const gb = isGoalReached(b);
    if (ga !== gb) return ga ? 1 : -1;

    const la = lastOccurredAtByCategory.get(a.id)?.getTime() ?? -1;
    const lb = lastOccurredAtByCategory.get(b.id)?.getTime() ?? -1;
    if (la !== lb) return lb - la;

    const ra = sortRank(a);
    const rb = sortRank(b);
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title);
  });

  return result;
};

type GetCategorySeriesArgs = {
  categoryId: string;
  period: Period;
  offset?: number; // 0 = current, negative = past periods
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextBucketStart(d: Date, period: Period): Date {
  if (period === "day") return addDays(d, 1);
  if (period === "week") return addDays(d, 7);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Date(d.getFullYear() + 1, 0, 1);
}

function bucketLabel(start: Date, period: Period): string {
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  if (period === "day") return `${dd}.${m}.`;
  if (period === "week") return `${dd}.${m}.`;
  if (period === "month") {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[start.getMonth()] ?? `${m}.${y}`;
  }
  return `${y}`;
}

function getBucketCount(period: Period): number {
  if (period === "day") return 14;
  if (period === "week") return 12;
  if (period === "month") return 12;
  return 6;
}

export const getCategorySeries: GetCategorySeries<
  GetCategorySeriesArgs,
  SeriesBucket[]
> = async ({ categoryId, period, offset }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;
  const ownsCategory = await context.entities.Category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!ownsCategory) {
    throw new HttpError(404, "Category not found");
  }

  const rawOffset = Math.min(0, Math.trunc(offset ?? 0));
  const baseNow = new Date();
  let now = baseNow;
  if (period === "day") now = addDays(baseNow, rawOffset);
  else if (period === "week") now = addDays(baseNow, rawOffset * 7);
  else if (period === "month") now = new Date(baseNow.getFullYear(), baseNow.getMonth() + rawOffset, 1);
  else now = new Date(baseNow.getFullYear() + rawOffset, 0, 1);
  const count = getBucketCount(period);

  let cursor: Date;
  if (period === "day") cursor = startOfDay(addDays(now, -(count - 1)));
  else if (period === "week")
    cursor = startOfWeek(addDays(now, -7 * (count - 1)));
  else if (period === "month") cursor = startOfMonth(now);
  else cursor = startOfYear(now);

  // For month/year we want the last N buckets ending at current.
  if (period === "month") {
    cursor = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (count - 1), 1));
  }
  if (period === "year") {
    cursor = startOfYear(new Date(now.getFullYear() - (count - 1), 0, 1));
  }

  const start = cursor;
  let end = cursor;
  for (let i = 0; i < count; i++) end = nextBucketStart(end, period);

  const events = await context.entities.Event.findMany({
    where: {
      userId,
      categoryId,
      occurredAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      occurredAt: true,
      amount: true,
    },
  });

  const buckets: { start: Date; end: Date; total: number }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, total: 0 });
    bStart = bEnd;
  }

  for (const ev of events) {
    const t = ev.occurredAt.getTime();
    const amount = ev.amount ?? 0;
    for (const b of buckets) {
      if (t >= b.start.getTime() && t < b.end.getTime()) {
        b.total += amount;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    label: bucketLabel(b.start, period),
    total: b.total,
    startDate: toIsoDate(b.start),
  }));
};

export const getCategoryLineSeries: GetCategoryLineSeries<
  GetCategorySeriesArgs,
  LinePoint[]
> = async ({ categoryId, period, offset }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;
  const ownsCategory = await context.entities.Category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!ownsCategory) {
    throw new HttpError(404, "Category not found");
  }

  const rawOffset = Math.min(0, Math.trunc(offset ?? 0));
  const baseNow = new Date();
  let now = baseNow;
  if (period === "day") now = addDays(baseNow, rawOffset);
  else if (period === "week") now = addDays(baseNow, rawOffset * 7);
  else if (period === "month") now = new Date(baseNow.getFullYear(), baseNow.getMonth() + rawOffset, 1);
  else now = new Date(baseNow.getFullYear() + rawOffset, 0, 1);
  const count = getBucketCount(period);

  let cursor: Date;
  if (period === "day") cursor = startOfDay(addDays(now, -(count - 1)));
  else if (period === "week")
    cursor = startOfWeek(addDays(now, -7 * (count - 1)));
  else if (period === "month") cursor = startOfMonth(now);
  else cursor = startOfYear(now);

  if (period === "month") {
    cursor = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (count - 1), 1));
  }
  if (period === "year") {
    cursor = startOfYear(new Date(now.getFullYear() - (count - 1), 0, 1));
  }

  const start = cursor;
  let end = cursor;
  for (let i = 0; i < count; i++) end = nextBucketStart(end, period);

  const events = await context.entities.Event.findMany({
    where: {
      userId,
      categoryId,
      amount: { not: null },
      occurredAt: { gte: start, lt: end },
    },
    select: { occurredAt: true, amount: true },
    orderBy: [{ occurredAt: "asc" }],
  });

  const buckets: { start: Date; end: Date; value: number | null }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, value: null });
    bStart = bEnd;
  }

  for (const ev of events) {
    const t = ev.occurredAt.getTime();
    const v = ev.amount ?? null;
    if (v == null) continue;
    for (const b of buckets) {
      if (t >= b.start.getTime() && t < b.end.getTime()) {
        b.value = v; // last value in bucket wins (events are asc)
      }
    }
  }

  return buckets.map((b) => ({
    label: bucketLabel(b.start, period),
    startDate: toIsoDate(b.start),
    value: b.value,
  }));
};

type GetCategoryEventsArgs = {
  categoryId: string;
  take?: number;
  before?: string; // ISO string
};

export const getCategoryEvents: GetCategoryEvents<
  GetCategoryEventsArgs,
  CategoryEventItem[]
> = async ({ categoryId, take, before }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;
  const ownsCategory = await context.entities.Category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!ownsCategory) {
    throw new HttpError(404, "Category not found");
  }

  const limit = Math.max(1, Math.min(200, take ?? 50));
  const beforeDate = before ? new Date(before) : null;

  return context.entities.Event.findMany({
    where: {
      userId,
      kind: "SESSION",
      categoryId,
      ...(beforeDate
        ? {
            occurredAt: { lt: beforeDate },
          }
        : {}),
    },
    select: {
      id: true,
      amount: true,
      occurredAt: true,
      occurredOn: true,
      rawText: true,
      data: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit,
  });
};
