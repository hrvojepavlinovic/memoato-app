import type {
  CategoryWithStats,
  LinePoint,
  Period,
  SeriesBucket,
  CategoryEventItem,
  CategoryChartType,
  BucketAggregation,
  GoalDirection,
} from "./types";

export type LocalCategory = {
  id: string;
  userId: string;
  title: string;
  slug: string;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  chartType: CategoryChartType;
  period: Period | null;
  unit: string | null;
  accentHex: string;
  emoji: string | null;
  isSystem: boolean;
  sortOrder?: number | null;
  bucketAggregation?: BucketAggregation | null;
  goalDirection?: GoalDirection | null;
  goalWeekly: number | null;
  goalValue: number | null;
  fieldsSchema?: any | null;
  sourceArchivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalEvent = {
  id: string;
  userId: string;
  kind: "SESSION";
  categoryId: string;
  amount: number;
  duration?: number | null;
  rawText: string | null;
  occurredAt: string; // ISO
  occurredOn: string; // YYYY-MM-DD
  data: any | null;
  createdAt: string;
  updatedAt: string;
};

const DB_NAME = "memoato.local.v1";
const DB_VERSION = 1;

function emitLocalChanged(userId: string): void {
  window.dispatchEvent(new CustomEvent("memoato:localChanged", { detail: { userId } }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("categories")) {
        const store = db.createObjectStore("categories", { keyPath: "id" });
        store.createIndex("byUser", "userId", { unique: false });
        store.createIndex("byUserSlug", ["userId", "slug"], { unique: true });
      }
      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", { keyPath: "id" });
        store.createIndex("byUser", "userId", { unique: false });
        store.createIndex("byUserCategoryOccurredAt", ["userId", "categoryId", "occurredAt"], { unique: false });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function withStore<T>(
  db: IDBDatabase,
  storeName: "categories" | "events",
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result: any = undefined;
    fn(store);
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    (tx as any)._setResult = (v: any) => {
      result = v;
    };
  });
}

async function getAllByIndex<T>(
  db: IDBDatabase,
  storeName: "categories" | "events",
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName).index(indexName);
    const req = store.getAll(key);
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

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

function bucketLabel(start: Date, period: Period): string {
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  if (period === "day") return `${dd}.${m}.`;
  if (period === "week") return `${dd}.${m}.`;
  if (period === "month") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

function parseOccurred(occurredOn?: string): { occurredAt: Date; occurredOn: Date } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (!occurredOn || occurredOn === todayIso) {
    const on = new Date(now);
    on.setHours(0, 0, 0, 0);
    return { occurredAt: now, occurredOn: on };
  }

  const [y, m, d] = occurredOn.split("-").map((x) => Number(x));
  const on = new Date(y, m - 1, d);
  on.setHours(0, 0, 0, 0);
  if (on.getTime() > startOfToday.getTime()) {
    throw new Error("Future dates are not allowed.");
  }
  const at = new Date(on);
  at.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return { occurredAt: at, occurredOn: on };
}

function parseOccurredAt(occurredAt: string): { occurredAt: Date; occurredOn: Date } {
  const d = new Date(occurredAt);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date/time");
  }
  const on = new Date(d);
  on.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (on.getTime() > startOfToday.getTime()) {
    throw new Error("Future dates are not allowed.");
  }
  return { occurredAt: d, occurredOn: on };
}

function sortRank(c: CategoryWithStats): number {
  if (c.chartType === "line") return 2;
  if (c.goalWeekly != null && c.goalWeekly > 0) return 0;
  return 1;
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

function isGoalReached(c: CategoryWithStats): boolean {
  if (c.chartType === "line") {
    if (c.goalValue == null || c.lastValue == null) return false;
    const dir = normalizeGoalDirection(c);
    if (dir === "at_most") return c.lastValue <= c.goalValue;
    if (dir === "at_least") return c.lastValue >= c.goalValue;
    const tol = Math.max(0.1, Math.abs(c.goalValue) * 0.01);
    return Math.abs(c.lastValue - c.goalValue) <= tol;
  }
  if (c.goalWeekly == null || c.goalWeekly <= 0) return false;
  const dir = normalizeGoalDirection(c);
  if (dir === "at_most") return c.thisWeekTotal <= c.goalWeekly;
  if (dir === "at_least") return c.thisWeekTotal >= c.goalWeekly;
  const tol = Math.max(1, Math.abs(c.goalWeekly) * 0.02);
  return Math.abs(c.thisWeekTotal - c.goalWeekly) <= tol;
}

export async function localListCategories(userId: string): Promise<LocalCategory[]> {
  const db = await openDb();
  const categories = await getAllByIndex<LocalCategory>(db, "categories", "byUser", userId);
  return categories.filter((c) => c.sourceArchivedAt == null);
}

export async function localGetCategoriesWithStats(userId: string): Promise<CategoryWithStats[]> {
  const db = await openDb();
  const [categories, events] = await Promise.all([
    getAllByIndex<LocalCategory>(db, "categories", "byUser", userId),
    getAllByIndex<LocalEvent>(db, "events", "byUser", userId),
  ]);

  const visibleCategories = categories.filter((c) => c.sourceArchivedAt == null);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yearStart = startOfYear(now);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

  const sums = {
    day: new Map<string, number>(),
    week: new Map<string, number>(),
    month: new Map<string, number>(),
    year: new Map<string, number>(),
  };
  const counts = {
    day: new Map<string, number>(),
    week: new Map<string, number>(),
    month: new Map<string, number>(),
    year: new Map<string, number>(),
  };
  const lastOccurredAtByCategory = new Map<string, Date>();
  const lastByCategory = new Map<string, number>();
  const recentStart = addDays(dayStart, -30);
  const recentTimingByCategory = new Map<
    string,
    { count: number; activeDays: Set<string>; sumMinutes: number }
  >();
  const recentAmountByCategory = new Map<string, { sum: number; count: number; lastAmount: number | null }>();
  const recentLastOccurredAtByCategory = new Map<string, Date>();

  for (const ev of events) {
    if (ev.kind !== "SESSION") continue;
    const t = new Date(ev.occurredAt);
    if (Number.isNaN(t.getTime())) continue;
    const categoryId = ev.categoryId;
    if (ev.amount == null) continue;
    const amount = ev.amount;

    const prevLast = lastOccurredAtByCategory.get(categoryId);
    if (!prevLast || t.getTime() > prevLast.getTime()) {
      lastOccurredAtByCategory.set(categoryId, t);
    }

    // For line charts: last value by occurredAt desc.
    if (!lastByCategory.has(categoryId)) {
      // We'll compute after sorting, so ignore here.
    }

    const ms = t.getTime();
    if (ms >= dayStart.getTime() && ms < dayEnd.getTime()) {
      sums.day.set(categoryId, (sums.day.get(categoryId) ?? 0) + amount);
      counts.day.set(categoryId, (counts.day.get(categoryId) ?? 0) + 1);
    }
    if (ms >= weekStart.getTime() && ms < weekEnd.getTime()) {
      sums.week.set(categoryId, (sums.week.get(categoryId) ?? 0) + amount);
      counts.week.set(categoryId, (counts.week.get(categoryId) ?? 0) + 1);
    }
    if (ms >= monthStart.getTime() && ms < monthEnd.getTime()) {
      sums.month.set(categoryId, (sums.month.get(categoryId) ?? 0) + amount);
      counts.month.set(categoryId, (counts.month.get(categoryId) ?? 0) + 1);
    }
    if (ms >= yearStart.getTime() && ms < yearEnd.getTime()) {
      sums.year.set(categoryId, (sums.year.get(categoryId) ?? 0) + amount);
      counts.year.set(categoryId, (counts.year.get(categoryId) ?? 0) + 1);
    }

    if (ms >= recentStart.getTime() && ms < dayEnd.getTime()) {
      const minute = t.getHours() * 60 + t.getMinutes();
      const prev = recentTimingByCategory.get(categoryId) ?? { count: 0, activeDays: new Set<string>(), sumMinutes: 0 };
      prev.count += 1;
      prev.sumMinutes += minute;
      prev.activeDays.add(ev.occurredOn);
      recentTimingByCategory.set(categoryId, prev);

      const aPrev = recentAmountByCategory.get(categoryId) ?? { sum: 0, count: 0, lastAmount: null };
      aPrev.sum += amount;
      aPrev.count += 1;
      recentAmountByCategory.set(categoryId, aPrev);

      const prevRecentLast = recentLastOccurredAtByCategory.get(categoryId);
      if (!prevRecentLast || t.getTime() > prevRecentLast.getTime()) {
        recentLastOccurredAtByCategory.set(categoryId, t);
        const row = recentAmountByCategory.get(categoryId);
        if (row) row.lastAmount = amount;
      }
    }
  }

  // Compute lastByCategory for line charts.
  const lineCategoryIds = new Set(
    visibleCategories.filter((c) => (c.chartType ?? "bar") === "line").map((c) => c.id),
  );
  const lineEvents = events
    .filter((e) => lineCategoryIds.has(e.categoryId) && e.amount != null)
    .sort((a, b) => {
      const ta = a.occurredAt;
      const tb = b.occurredAt;
      if (ta !== tb) return tb.localeCompare(ta);
      return b.id.localeCompare(a.id);
    });
  for (const ev of lineEvents) {
    if (!lastByCategory.has(ev.categoryId)) lastByCategory.set(ev.categoryId, ev.amount);
  }

  function normalizePeriod(v: unknown): Period {
    const s = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (s === "day") return "day";
    if (s === "week") return "week";
    if (s === "month") return "month";
    if (s === "year") return "year";
    return "week";
  }

  function normalizeAgg(chartType: CategoryChartType, v: unknown): BucketAggregation {
    const s = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (s === "sum") return "sum";
    if (s === "avg") return "avg";
    if (s === "last") return "last";
    return chartType === "line" ? "last" : "sum";
  }

  function windowValue(sumMap: Map<string, number>, countMap: Map<string, number>, categoryId: string, agg: BucketAggregation): number {
    if (agg === "avg") {
      const count = countMap.get(categoryId) ?? 0;
      if (count <= 0) return 0;
      const sum = sumMap.get(categoryId) ?? 0;
      return sum / count;
    }
    return sumMap.get(categoryId) ?? 0;
  }

  const result: CategoryWithStats[] = visibleCategories.map((c) => {
    const chartType = (c.chartType ?? "bar") as CategoryChartType;
    const agg = normalizeAgg(chartType, (c as any).bucketAggregation);
    const period = normalizePeriod(c.period);
    const periodSumMap =
      period === "day" ? sums.day : period === "month" ? sums.month : period === "year" ? sums.year : sums.week;
    const periodCountMap =
      period === "day" ? counts.day : period === "month" ? counts.month : period === "year" ? counts.year : counts.week;

    const timing = recentTimingByCategory.get(c.id);
    const recentActiveDays30d = timing ? timing.activeDays.size : 0;
    const recentAvgMinuteOfDay30d = timing && timing.count > 0 ? Math.round(timing.sumMinutes / timing.count) : null;
    const recentAvgEventsPerDay30d =
      timing && timing.activeDays.size > 0 ? timing.count / timing.activeDays.size : 0;
    const recentAmt = recentAmountByCategory.get(c.id);
    const recentAvgAmount30d = recentAmt && recentAmt.count > 0 ? recentAmt.sum / recentAmt.count : null;
    const recentLastAmount30d = recentAmt?.lastAmount ?? null;

    return {
      id: c.id,
      title: c.title,
      slug: c.slug ?? slugifyTitle(c.title),
      unit: c.unit ?? null,
      chartType,
      categoryType: c.categoryType,
      accentHex: c.accentHex,
      emoji: c.emoji ?? null,
      isSystem: !!(c as any).isSystem,
      sortOrder: typeof (c as any).sortOrder === "number" ? ((c as any).sortOrder as number) : null,
      bucketAggregation: ((c as any).bucketAggregation as any) ?? null,
      goalDirection: ((c as any).goalDirection as any) ?? null,
      period,
      goalWeekly: c.goalWeekly ?? null,
      goalValue: c.goalValue ?? null,
      fieldsSchema: (c as any).fieldsSchema ?? null,
      todayCount: counts.day.get(c.id) ?? 0,
      thisWeekCount: counts.week.get(c.id) ?? 0,
      thisMonthCount: counts.month.get(c.id) ?? 0,
      thisYearCount: counts.year.get(c.id) ?? 0,
      todayTotal: windowValue(sums.day, counts.day, c.id, agg),
      thisWeekTotal: windowValue(periodSumMap, periodCountMap, c.id, agg),
      thisYearTotal: windowValue(sums.year, counts.year, c.id, agg),
      lastValue: lastByCategory.get(c.id) ?? null,
      recentAvgAmount30d,
      recentLastAmount30d,
      recentActiveDays30d,
      recentAvgMinuteOfDay30d,
      recentAvgEventsPerDay30d,
    };
  });

  const hasCustomOrder = result.some((c) => c.sortOrder != null);

  function autoCompare(a: CategoryWithStats, b: CategoryWithStats): number {
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
  }

  result.sort((a, b) => {
    if (!hasCustomOrder) return autoCompare(a, b);

    const ao = a.sortOrder;
    const bo = b.sortOrder;
    if (ao != null || bo != null) {
      if (ao == null) return 1;
      if (bo == null) return -1;
      if (ao !== bo) return ao - bo;
      return autoCompare(a, b);
    }
    return autoCompare(a, b);
  });

  return result;
}

export async function localSetCategoryOrder(args: { userId: string; orderedCategoryIds: string[] }): Promise<void> {
  const db = await openDb();
  const { userId, orderedCategoryIds } = args;
  const categories = await getAllByIndex<LocalCategory>(db, "categories", "byUser", userId);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const now = new Date().toISOString();
  await withStore<void>(db, "categories", "readwrite", (store) => {
    orderedCategoryIds.forEach((id, i) => {
      const c = byId.get(id);
      if (!c) return;
      store.put({ ...c, sortOrder: i, updatedAt: now } satisfies LocalCategory);
    });
  });
  emitLocalChanged(userId);
}

export async function localResetCategoryOrder(args: { userId: string }): Promise<void> {
  const db = await openDb();
  const { userId } = args;
  const categories = await getAllByIndex<LocalCategory>(db, "categories", "byUser", userId);
  const now = new Date().toISOString();
  await withStore<void>(db, "categories", "readwrite", (store) => {
    for (const c of categories) {
      if (c.userId !== userId) continue;
      store.put({ ...c, sortOrder: null, updatedAt: now } satisfies LocalCategory);
    }
  });
  emitLocalChanged(userId);
}

export async function localGetCategoryEvents(args: {
  userId: string;
  categoryId: string;
  take?: number;
  before?: string;
}): Promise<CategoryEventItem[]> {
  const { userId, categoryId, take, before } = args;
  const db = await openDb();

  const limit = Math.max(1, Math.min(200, take ?? 50));
  const range = IDBKeyRange.bound(
    [userId, categoryId, ""],
    [userId, categoryId, "\uffff"],
  );
  const events: LocalEvent[] = await new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("byUserCategoryOccurredAt");
    const out: LocalEvent[] = [];
    index.openCursor(range, "prev").onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      const v = cursor.value as LocalEvent;
      if (before && v.occurredAt >= before) {
        cursor.continue();
        return;
      }
      out.push(v);
      if (out.length >= limit) return;
      cursor.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return events.map((e) => ({
    id: e.id,
    amount: e.amount ?? null,
    occurredAt: new Date(e.occurredAt),
    occurredOn: new Date(e.occurredOn),
    rawText: e.rawText ?? null,
    data: e.data ?? null,
  }));
}

export async function localCreateCategory(args: {
  userId: string;
  title: string;
  slug?: string | null;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  chartType?: CategoryChartType;
  period?: Period;
  unit?: string | null;
  goal?: number | null;
  goalValue?: number | null;
  accentHex: string;
  emoji?: string | null;
  bucketAggregation?: BucketAggregation | null;
  goalDirection?: GoalDirection | null;
  isSystem?: boolean | null;
  fieldsSchema?: any | null;
}): Promise<Pick<CategoryWithStats, "id" | "slug">> {
  const db = await openDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const cleanTitle = args.title.trim();
  const existing = await getAllByIndex<LocalCategory>(db, "categories", "byUser", args.userId);
  const used = new Set(existing.map((c) => c.slug));
  let slug = "";
  const forcedSlug = typeof args.slug === "string" ? args.slug.trim() : "";
  if (forcedSlug) {
    if (used.has(forcedSlug)) {
      throw new Error(`Category slug '${forcedSlug}' already exists.`);
    }
    slug = forcedSlug;
  } else {
    const base = slugifyTitle(cleanTitle);
    slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
  }
  const chartType: CategoryChartType = args.chartType ?? (args.categoryType === "GOAL" ? "line" : "bar");
  const needsPeriod = chartType !== "line";

  const record: LocalCategory = {
    id,
    userId: args.userId,
    title: cleanTitle,
    slug,
    categoryType: args.categoryType,
    chartType,
    period: needsPeriod ? args.period ?? "week" : null,
    unit: args.unit && args.unit.trim().length > 0 ? args.unit : null,
    accentHex: args.accentHex,
    emoji: args.emoji && args.emoji.trim().length > 0 ? args.emoji : null,
    isSystem: !!args.isSystem,
    bucketAggregation: args.bucketAggregation ?? null,
    goalDirection: args.goalDirection ?? null,
    goalWeekly: needsPeriod ? args.goal ?? null : null,
    goalValue: chartType === "line" ? args.goalValue ?? null : null,
    fieldsSchema: args.fieldsSchema ?? null,
    sourceArchivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await withStore<void>(db, "categories", "readwrite", (store) => {
    const req = store.add(record);
    req.onerror = () => {};
  });
  emitLocalChanged(args.userId);

  return { id, slug };
}

export async function localUpdateCategory(args: {
  userId: string;
  categoryId: string;
  title: string;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  chartType?: CategoryChartType;
  period?: Period;
  unit?: string | null;
  goal?: number | null;
  goalValue?: number | null;
  accentHex: string;
  emoji?: string | null;
  bucketAggregation?: BucketAggregation | null;
  goalDirection?: GoalDirection | null;
}): Promise<void> {
  const db = await openDb();
  const now = new Date().toISOString();
  const existing = await new Promise<LocalCategory | null>((resolve, reject) => {
    const tx = db.transaction("categories", "readonly");
    const req = tx.objectStore("categories").get(args.categoryId);
    req.onsuccess = () => resolve((req.result as LocalCategory) ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!existing || existing.userId !== args.userId) throw new Error("Category not found");

  const chartType: CategoryChartType = args.chartType ?? (args.categoryType === "GOAL" ? "line" : "bar");
  const needsPeriod = chartType !== "line";
  const updated: LocalCategory = {
    ...existing,
    title: args.title.trim(),
    categoryType: args.categoryType,
    chartType,
    period: needsPeriod ? args.period ?? "week" : null,
    unit: args.unit && args.unit.trim().length > 0 ? args.unit : null,
    accentHex: args.accentHex,
    emoji: args.emoji && args.emoji.trim().length > 0 ? args.emoji : null,
    isSystem: existing.isSystem ?? false,
    bucketAggregation: args.bucketAggregation ?? (existing as any).bucketAggregation ?? null,
    goalDirection: args.goalDirection ?? (existing as any).goalDirection ?? null,
    goalWeekly: needsPeriod ? args.goal ?? null : null,
    goalValue: chartType === "line" ? args.goalValue ?? null : null,
    updatedAt: now,
  };

  await withStore<void>(db, "categories", "readwrite", (store) => {
    store.put(updated);
  });
  emitLocalChanged(args.userId);
}

export async function localDeleteCategory(args: { userId: string; categoryId: string }): Promise<void> {
  const db = await openDb();
  const { userId, categoryId } = args;

  const existing = await new Promise<LocalCategory | null>((resolve, reject) => {
    const tx = db.transaction("categories", "readonly");
    const req = tx.objectStore("categories").get(categoryId);
    req.onsuccess = () => resolve((req.result as LocalCategory) ?? null);
    req.onerror = () => reject(req.error);
  });
  if (existing && existing.userId === userId && existing.isSystem) {
    throw new Error("This category can't be deleted.");
  }

  await withStore<void>(db, "categories", "readwrite", (store) => {
    store.delete(categoryId);
  });

  const range = IDBKeyRange.bound([userId, categoryId, ""], [userId, categoryId, "\uffff"]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const index = tx.objectStore("events").index("byUserCategoryOccurredAt");
    index.openCursor(range).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLocalChanged(userId);
}

export async function localCreateEvent(args: {
  userId: string;
  categoryId: string;
  amount: number;
  occurredOn?: string;
  duration?: number | null;
  fields?: Record<string, number | string> | null;
  note?: string | null;
  noteEnc?: any | null;
}): Promise<void> {
  const db = await openDb();
  const nowIso = new Date().toISOString();
  const { occurredAt, occurredOn } = parseOccurred(args.occurredOn);

  const id = crypto.randomUUID();
  const nextData: Record<string, unknown> = {};
  const cleanDuration =
    typeof args.duration === "number" && Number.isFinite(args.duration) && args.duration > 0
      ? Math.round(Math.min(args.duration, 24 * 60))
      : null;
  const cleanFields: Record<string, number | string> = {};
  if (args.fields && typeof args.fields === "object" && !Array.isArray(args.fields)) {
    for (const [k, v] of Object.entries(args.fields)) {
      const key = String(k).trim();
      if (!key) continue;
      if (typeof v === "number" && Number.isFinite(v)) {
        cleanFields[key] = v;
      } else if (typeof v === "string") {
        const s = v.trim();
        if (s) cleanFields[key] = s;
      }
    }
  }
  if (Object.keys(cleanFields).length > 0) {
    nextData.fields = cleanFields;
  }
  if (args.noteEnc != null) {
    nextData.noteEnc = args.noteEnc as any;
    nextData.note = null;
  } else if (typeof args.note === "string") {
    const clean = args.note.trim();
    nextData.note = clean.length > 0 ? clean : null;
  }
  const record: LocalEvent = {
    id,
    userId: args.userId,
    kind: "SESSION",
    categoryId: args.categoryId,
    amount: args.amount,
    duration: cleanDuration,
    rawText: null,
    occurredAt: occurredAt.toISOString(),
    occurredOn: toIsoDate(occurredOn),
    data: Object.keys(nextData).length > 0 ? (nextData as any) : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await withStore<void>(db, "events", "readwrite", (store) => {
    store.add(record);
  });
  emitLocalChanged(args.userId);
}

export async function localUpdateEvent(args: {
  userId: string;
  eventId: string;
  amount: number;
  occurredAt: string;
  note?: string | null;
  noteEnc?: any | null;
}): Promise<void> {
  const db = await openDb();
  const existing = await new Promise<LocalEvent | null>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const req = tx.objectStore("events").get(args.eventId);
    req.onsuccess = () => resolve((req.result as LocalEvent) ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!existing || existing.userId !== args.userId) throw new Error("Event not found");

  const occurred = parseOccurredAt(args.occurredAt);
  const baseData =
    existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const nextData: Record<string, unknown> = { ...baseData };
  if ("tags" in nextData) delete nextData.tags;
  if (args.noteEnc !== undefined) {
    if (args.noteEnc == null) {
      delete nextData.noteEnc;
      if (args.note !== undefined) {
        const cleanNote = typeof args.note === "string" ? args.note.trim() : "";
        nextData.note = cleanNote ? cleanNote : null;
      } else {
        nextData.note = null;
      }
    } else {
      nextData.noteEnc = args.noteEnc as any;
      nextData.note = null;
    }
  } else if (args.note !== undefined) {
    const cleanNote = typeof args.note === "string" ? args.note.trim() : "";
    nextData.note = cleanNote ? cleanNote : null;
    if ("noteEnc" in nextData) delete nextData.noteEnc;
  }

  const updated: LocalEvent = {
    ...existing,
    amount: args.amount,
    occurredAt: occurred.occurredAt.toISOString(),
    occurredOn: toIsoDate(occurred.occurredOn),
    data: nextData,
    updatedAt: new Date().toISOString(),
  };

  await withStore<void>(db, "events", "readwrite", (store) => {
    store.put(updated);
  });
  emitLocalChanged(args.userId);
}

export async function localDeleteEvent(args: { userId: string; eventId: string }): Promise<void> {
  const db = await openDb();
  const existing = await new Promise<LocalEvent | null>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const req = tx.objectStore("events").get(args.eventId);
    req.onsuccess = () => resolve((req.result as LocalEvent) ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!existing || existing.userId !== args.userId) throw new Error("Event not found");

  await withStore<void>(db, "events", "readwrite", (store) => {
    store.delete(args.eventId);
  });
  emitLocalChanged(args.userId);
}

export async function localGetBarSeries(args: {
  userId: string;
  categoryId: string;
  period: Period;
  offset?: number;
  aggregation?: BucketAggregation | null;
}): Promise<SeriesBucket[]> {
  const { userId, categoryId, period, offset } = args;
  const aggregation: BucketAggregation = args.aggregation === "avg" ? "avg" : "sum";
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
  else if (period === "week") cursor = startOfWeek(addDays(now, -7 * (count - 1)));
  else if (period === "month") cursor = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (count - 1), 1));
  else cursor = startOfYear(new Date(now.getFullYear() - (count - 1), 0, 1));

  let end = cursor;
  for (let i = 0; i < count; i++) end = nextBucketStart(end, period);

  const buckets: { start: Date; end: Date; total: number; count: number }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, total: 0, count: 0 });
    bStart = bEnd;
  }

  const db = await openDb();
  const range = IDBKeyRange.bound(
    [userId, categoryId, cursor.toISOString()],
    [userId, categoryId, end.toISOString()],
    false,
    true,
  );
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("byUserCategoryOccurredAt");
    index.openCursor(range).onsuccess = (e) => {
      const cursor2 = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor2) return;
      const ev = cursor2.value as LocalEvent;
      const t = new Date(ev.occurredAt).getTime();
      const amount = ev.amount ?? 0;
      for (const b of buckets) {
        if (t >= b.start.getTime() && t < b.end.getTime()) {
          b.total += amount;
          b.count += 1;
          break;
        }
      }
      cursor2.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return buckets.map((b) => ({
    label: bucketLabel(b.start, period),
    total: aggregation === "avg" && b.count > 0 ? b.total / b.count : b.total,
    startDate: toIsoDate(b.start),
  }));
}

export async function localGetLineSeries(args: {
  userId: string;
  categoryId: string;
  period: Period;
  offset?: number;
  aggregation?: BucketAggregation | null;
}): Promise<LinePoint[]> {
  const { userId, categoryId, period, offset } = args;
  const aggregation: BucketAggregation = args.aggregation === "avg" ? "avg" : "last";
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
  else if (period === "week") cursor = startOfWeek(addDays(now, -7 * (count - 1)));
  else if (period === "month") cursor = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (count - 1), 1));
  else cursor = startOfYear(new Date(now.getFullYear() - (count - 1), 0, 1));

  let end = cursor;
  for (let i = 0; i < count; i++) end = nextBucketStart(end, period);

  const buckets: { start: Date; end: Date; value: number | null; sum: number; count: number }[] = [];
  let bStart = cursor;
  for (let i = 0; i < count; i++) {
    const bEnd = nextBucketStart(bStart, period);
    buckets.push({ start: bStart, end: bEnd, value: null, sum: 0, count: 0 });
    bStart = bEnd;
  }

  const db = await openDb();
  const range = IDBKeyRange.bound(
    [userId, categoryId, cursor.toISOString()],
    [userId, categoryId, end.toISOString()],
    false,
    true,
  );
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("byUserCategoryOccurredAt");
    index.openCursor(range).onsuccess = (e) => {
      const cursor2 = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor2) return;
      const ev = cursor2.value as LocalEvent;
      const t = new Date(ev.occurredAt).getTime();
      const v = ev.amount ?? null;
      if (v != null) {
        for (const b of buckets) {
          if (t >= b.start.getTime() && t < b.end.getTime()) {
            b.sum += v;
            b.count += 1;
            if (aggregation === "last") b.value = v;
            else b.value = b.sum / b.count;
          }
        }
      }
      cursor2.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return buckets.map((b) => ({ label: bucketLabel(b.start, period), startDate: toIsoDate(b.start), value: b.value }));
}

export async function localReplaceAll(args: {
  userId: string;
  categories: Array<Omit<LocalCategory, "userId">>;
  events: Array<Omit<LocalEvent, "userId">>;
}): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["categories", "events"], "readwrite");
    const catStore = tx.objectStore("categories");
    const evStore = tx.objectStore("events");

    catStore.index("byUser").openCursor(IDBKeyRange.only(args.userId)).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    evStore.index("byUser").openCursor(IDBKeyRange.only(args.userId)).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };

    for (const c of args.categories) catStore.put({ ...c, userId: args.userId } satisfies LocalCategory);
    for (const ev of args.events) evStore.put({ ...ev, userId: args.userId } satisfies LocalEvent);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLocalChanged(args.userId);
}
