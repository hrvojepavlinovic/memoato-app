import { HttpError, prisma } from "wasp/server";
import type {
  GetPublicUserCategoryLineSeries,
  GetPublicUserCategorySeries,
  GetPublicUserDashboard,
} from "wasp/server/operations";
import type {
  BucketAggregation,
  CategoryChartType,
  CategoryWithStats,
  LinePoint,
  Period,
  SeriesBucket,
} from "../focus/types";

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

function parseCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    out.push(s);
  }
  return Array.from(new Set(out)).slice(0, 25);
}

function normalizePeriod(v: unknown): Period {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "day") return "day";
  if (s === "week") return "week";
  if (s === "month") return "month";
  if (s === "year") return "year";
  return "week";
}

function normalizeBucketAggregation(chartType: CategoryChartType, v: unknown): BucketAggregation {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "sum") return "sum";
  if (s === "avg") return "avg";
  if (s === "last") return "last";
  return chartType === "line" ? "last" : "sum";
}

type WindowStats = { sum: number; avg: number; count: number };

async function getCategoriesWithStatsForUser(args: {
  userId: string;
  categoryIds: string[];
}): Promise<CategoryWithStats[]> {
  const { userId, categoryIds } = args;

  const categories: any[] = await prisma.category.findMany({
    where: { userId, sourceArchivedAt: null, id: { in: categoryIds } },
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
      sortOrder: true,
      bucketAggregation: true,
      goalDirection: true,
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

  async function statsForWindow(start: Date, end: Date): Promise<Map<string, WindowStats>> {
    if (categoryIds.length === 0) return new Map();
    const totals = await prisma.event.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        kind: "SESSION",
        categoryId: { in: categoryIds },
        occurredAt: { gte: start, lt: end },
        amount: { not: null },
      },
      _sum: { amount: true },
      _avg: { amount: true },
      _count: { amount: true },
    });
    const m = new Map<string, WindowStats>();
    for (const t of totals) {
      if (!t.categoryId) continue;
      m.set(t.categoryId, {
        sum: t._sum.amount ?? 0,
        avg: (t._avg as any)?.amount ?? 0,
        count: (t._count as any)?.amount ?? 0,
      });
    }
    return m;
  }

  const [dayStats, weekStats, monthStats, yearStats] = await Promise.all([
    statsForWindow(dayStart, dayEnd),
    statsForWindow(weekStart, weekEnd),
    statsForWindow(monthStart, monthEnd),
    statsForWindow(yearStart, yearEnd),
  ]);

  function windowValue(m: Map<string, WindowStats>, categoryId: string, agg: BucketAggregation): number {
    const row = m.get(categoryId);
    if (!row) return 0;
    if (agg === "avg") return row.count > 0 ? row.avg : 0;
    return row.sum;
  }

  function windowCount(m: Map<string, WindowStats>, categoryId: string): number {
    const row = m.get(categoryId);
    return row ? row.count : 0;
  }

  const lastByCategory = new Map<string, number>();
  const lineCategoryIds = categories
    .filter((c) => (c.chartType ?? "bar") === "line")
    .map((c) => c.id);
  if (lineCategoryIds.length > 0) {
    const lastEvents = await prisma.event.findMany({
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

  return categories.map((c) => {
    const chartType = ((c.chartType ?? "bar") as CategoryChartType);
    const agg = normalizeBucketAggregation(chartType, c.bucketAggregation);
    const period = normalizePeriod(c.period);
    const periodStats =
      period === "day" ? dayStats : period === "month" ? monthStats : period === "year" ? yearStats : weekStats;

    return {
      id: c.id,
      title: c.title,
      slug: resolvedSlugById.get(c.id) ?? slugifyTitle(c.title),
      unit: c.unit ?? null,
      chartType,
      categoryType: c.categoryType,
      accentHex: c.accentHex,
      emoji: c.emoji ?? null,
      isSystem: !!c.isSystem,
      sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : null,
      bucketAggregation: typeof c.bucketAggregation === "string" ? (c.bucketAggregation as BucketAggregation) : null,
      goalDirection: typeof c.goalDirection === "string" ? (c.goalDirection as any) : null,
      period,
      goalWeekly: c.goalWeekly ?? null,
      goalValue: c.goalValue ?? null,
      todayCount: windowCount(dayStats, c.id),
      thisWeekCount: windowCount(weekStats, c.id),
      thisMonthCount: windowCount(monthStats, c.id),
      thisYearCount: windowCount(yearStats, c.id),
      todayTotal: windowValue(dayStats, c.id, agg),
      thisWeekTotal: windowValue(periodStats, c.id, agg),
      thisYearTotal: windowValue(yearStats, c.id, agg),
      lastValue: lastByCategory.get(c.id) ?? null,
      recentAvgAmount30d: null,
      recentLastAmount30d: null,
      recentActiveDays30d: 0,
      recentAvgMinuteOfDay30d: null,
      recentAvgEventsPerDay30d: 0,
    };
  });
}

export type PublicUserDashboard = {
  username: string;
  categories: CategoryWithStats[];
};

export const getPublicUserDashboard: GetPublicUserDashboard<{ username: string }, PublicUserDashboard> = async (
  args,
  _context,
) => {
  const username = String(args.username ?? "").trim();
  if (!username) throw new HttpError(400);

  const user = await prisma.user.findFirst({
    where: { username, publicStatsEnabled: true },
    select: { id: true, username: true, publicStatsCategoryIds: true },
  });
  if (!user) {
    throw new HttpError(404);
  }

  const categoryIds = parseCategoryIds(user.publicStatsCategoryIds);
  if (categoryIds.length === 0) {
    return { username: user.username, categories: [] };
  }

  const categories = await getCategoriesWithStatsForUser({ userId: user.id, categoryIds });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ordered = categoryIds.map((id) => byId.get(id)).filter(Boolean) as CategoryWithStats[];
  return { username: user.username, categories: ordered };
};

type PublicSeriesArgs = { username: string; categoryId: string; period: Period; offset?: number };

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextBucketStart(d: Date, period: Period): Date {
  if (period === "day") return addDays(d, 1);
  if (period === "week") return addDays(d, 7);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Date(d.getFullYear() + 1, 0, 1);
}

function getBucketCount(period: Period): number {
  if (period === "day") return 14;
  if (period === "week") return 12;
  if (period === "month") return 12;
  return 6;
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
  return String(y);
}

async function resolvePublicCategory(args: { username: string; categoryId: string }) {
  const username = String(args.username ?? "").trim();
  const categoryId = String(args.categoryId ?? "").trim();
  if (!username || !categoryId) throw new HttpError(400);

  const user = await prisma.user.findFirst({
    where: { username, publicStatsEnabled: true },
    select: { id: true, publicStatsCategoryIds: true },
  });
  if (!user) throw new HttpError(404);

  const allowed = new Set(parseCategoryIds(user.publicStatsCategoryIds));
  if (!allowed.has(categoryId)) throw new HttpError(404);

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id, sourceArchivedAt: null },
    select: { id: true, bucketAggregation: true, chartType: true },
  });
  if (!category) throw new HttpError(404);

  return { userId: user.id, category };
}

export const getPublicUserCategorySeries: GetPublicUserCategorySeries<PublicSeriesArgs, SeriesBucket[]> = async (
  args,
  _context,
) => {
  const period = normalizePeriod(args.period);
  const rawOffset = Math.min(0, Math.trunc(args.offset ?? 0));

  const { userId, category } = await resolvePublicCategory({ username: args.username, categoryId: args.categoryId });
  const chartType = ((category.chartType ?? "bar") as CategoryChartType);
  const aggregation = normalizeBucketAggregation(chartType, category.bucketAggregation);

  const baseNow = new Date();
  let now = baseNow;
  if (period === "day") now = addDays(baseNow, rawOffset);
  else if (period === "week") now = addDays(baseNow, rawOffset * 7);
  else if (period === "month") now = new Date(baseNow.getFullYear(), baseNow.getMonth() + rawOffset, 1);
  else now = new Date(baseNow.getFullYear() + rawOffset, 0, 1);
  const count = getBucketCount(period);

  let cursor: Date;
  if (period === "day") cursor = startOfDay(addDays(now, -(count - 1)));
  else if (period === "week") cursor = startOfWeek(addDays(now, -7 * (count - 1)));
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

  const events = await prisma.event.findMany({
    where: {
      userId,
      categoryId: category.id,
      kind: "SESSION",
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

  const buckets: { start: Date; end: Date; total: number; count: number }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, total: 0, count: 0 });
    bStart = bEnd;
  }

  for (const ev of events) {
    const t = (ev.occurredAt instanceof Date ? ev.occurredAt : new Date(ev.occurredAt as any)).getTime();
    const amount = typeof ev.amount === "number" ? ev.amount : 0;
    for (const b of buckets) {
      if (t >= b.start.getTime() && t < b.end.getTime()) {
        b.total += amount;
        b.count += 1;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    label: bucketLabel(b.start, period),
    total: aggregation === "avg" && b.count > 0 ? b.total / b.count : b.total,
    startDate: toIsoDate(b.start),
  }));
};

export const getPublicUserCategoryLineSeries: GetPublicUserCategoryLineSeries<PublicSeriesArgs, LinePoint[]> = async (
  args,
  _context,
) => {
  const period = normalizePeriod(args.period);
  const rawOffset = Math.min(0, Math.trunc(args.offset ?? 0));

  const { userId, category } = await resolvePublicCategory({ username: args.username, categoryId: args.categoryId });
  const chartType = ((category.chartType ?? "bar") as CategoryChartType);
  const aggregation = normalizeBucketAggregation(chartType, category.bucketAggregation);

  const baseNow = new Date();
  let now = baseNow;
  if (period === "day") now = addDays(baseNow, rawOffset);
  else if (period === "week") now = addDays(baseNow, rawOffset * 7);
  else if (period === "month") now = new Date(baseNow.getFullYear(), baseNow.getMonth() + rawOffset, 1);
  else now = new Date(baseNow.getFullYear() + rawOffset, 0, 1);
  const count = getBucketCount(period);

  let cursor: Date;
  if (period === "day") cursor = startOfDay(addDays(now, -(count - 1)));
  else if (period === "week") cursor = startOfWeek(addDays(now, -7 * (count - 1)));
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

  const events = await prisma.event.findMany({
    where: {
      userId,
      categoryId: category.id,
      kind: "SESSION",
      amount: { not: null },
      occurredAt: { gte: start, lt: end },
    },
    select: { occurredAt: true, amount: true },
    orderBy: [{ occurredAt: "asc" }],
  });

  const buckets: { start: Date; end: Date; value: number | null; sum: number; count: number }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, value: null, sum: 0, count: 0 });
    bStart = bEnd;
  }

  for (const ev of events) {
    const t = (ev.occurredAt instanceof Date ? ev.occurredAt : new Date(ev.occurredAt as any)).getTime();
    const v = typeof ev.amount === "number" ? ev.amount : null;
    if (v == null) continue;
    for (const b of buckets) {
      if (t >= b.start.getTime() && t < b.end.getTime()) {
        b.sum += v;
        b.count += 1;
        if (aggregation === "last") {
          b.value = v;
        } else if (aggregation === "sum") {
          b.value = b.sum;
        } else if (aggregation === "avg") {
          b.value = b.sum / b.count;
        }
      }
    }
  }

  return buckets.map((b) => ({
    label: bucketLabel(b.start, period),
    startDate: toIsoDate(b.start),
    value: b.value,
  }));
};
