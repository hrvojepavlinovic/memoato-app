import type { ServerSetupFn } from "wasp/server";
import { prisma } from "wasp/server";

function setCors(res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfIsoWeek(d: Date): Date {
  const out = startOfDay(d);
  const day = out.getDay(); // 0 (Sun) .. 6 (Sat)
  const isoIndex = (day + 6) % 7; // 0 (Mon) .. 6 (Sun)
  out.setDate(out.getDate() - isoIndex);
  return out;
}

function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

function startOfYear(d: Date): Date {
  const out = startOfDay(d);
  out.setMonth(0, 1);
  return out;
}

function getNumberField(data: unknown, key: string): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const fields = (data as any).fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const v = (fields as any)[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function normalizedUnit(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const s = u.trim().toLowerCase();
  if (!s || s === "x") return null;
  if (s === "cal" || s === "cals" || s === "calorie" || s === "calories") return "kcal";
  if (s === "kilogram" || s === "kilograms" || s === "kgs") return "kg";
  if (s === "liter" || s === "liters" || s === "litre" || s === "litres") return "l";
  if (s === "minute" || s === "minutes" || s === "mins") return "min";
  if (s === "hour" || s === "hours" || s === "hrs" || s === "hr") return "h";
  return s;
}

async function getLastAmountInRange(args: {
  userId: string;
  categoryId: string;
  from: Date;
  to: Date;
}): Promise<number | null> {
  const ev = await prisma.event.findFirst({
    where: {
      userId: args.userId,
      categoryId: args.categoryId,
      kind: "SESSION",
      occurredOn: { gte: args.from, lte: args.to },
    },
    orderBy: [{ occurredAt: "desc" }],
    select: { amount: true },
  });
  return typeof ev?.amount === "number" ? ev.amount : null;
}

async function getSumAmountInRange(args: {
  userId: string;
  categoryId: string;
  from: Date;
  to: Date;
}): Promise<number> {
  const res = await prisma.event.aggregate({
    where: {
      userId: args.userId,
      categoryId: args.categoryId,
      kind: "SESSION",
      occurredOn: { gte: args.from, lte: args.to },
    },
    _sum: { amount: true },
  });
  return typeof res._sum.amount === "number" ? res._sum.amount : 0;
}

async function getSumAmountInRangeMany(args: {
  userId: string;
  categoryIds: string[];
  from: Date;
  to: Date;
}): Promise<number> {
  if (args.categoryIds.length === 0) return 0;
  const res = await prisma.event.aggregate({
    where: {
      userId: args.userId,
      categoryId: { in: args.categoryIds },
      kind: "SESSION",
      occurredOn: { gte: args.from, lte: args.to },
    },
    _sum: { amount: true },
  });
  return typeof res._sum.amount === "number" ? res._sum.amount : 0;
}

function parseCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return Array.from(new Set(out)).slice(0, 25);
}

function addPublicStatsRoutes(app: any): void {
  app.options("/public/stats/:token", (_req: any, res: any) => {
    setCors(res);
    res.status(204).end();
  });

  app.get("/public/stats/:token", async (req: any, res: any) => {
    setCors(res);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");

    const token = String((req as any)?.params?.token ?? "").trim();
    if (!token || token.length < 20) {
      res.status(404).end(JSON.stringify({ error: "not_found" }));
      return;
    }

    try {
      const user = await prisma.user.findFirst({
        where: { publicStatsEnabled: true, publicStatsToken: token },
        select: { id: true, publicStatsCategoryIds: true, activeKcalRollupEnabled: true },
      });
      if (!user) {
        res.status(404).end(JSON.stringify({ error: "not_found" }));
        return;
      }

      const categoryIds = parseCategoryIds(user.publicStatsCategoryIds);
      if (categoryIds.length === 0) {
        res.status(200).end(
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            aggregation: "last",
            calendar: null,
            categories: [],
          }),
        );
        return;
      }

      const categories = await prisma.category.findMany({
        where: { userId: user.id, sourceArchivedAt: null, id: { in: categoryIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          unit: true,
          chartType: true,
          bucketAggregation: true,
          rollupToActiveKcal: true,
        },
      });

      const byId = new Map(categories.map((c) => [c.id, c]));
      const ordered = categoryIds.map((id) => byId.get(id)).filter(Boolean) as typeof categories;

      const now = new Date();
      const today = startOfDay(now);
      const weekStart = startOfIsoWeek(now);
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      const calendar = {
        today: { from: toIsoDate(today), to: toIsoDate(today) },
        week: { from: toIsoDate(weekStart), to: toIsoDate(today) },
        month: { from: toIsoDate(monthStart), to: toIsoDate(today) },
        year: { from: toIsoDate(yearStart), to: toIsoDate(today) },
      };

      // If Active kcal rollup is enabled, compute sums including kcal fields in a single pass.
      const activeKcal = ordered.find((c) => String(c.slug ?? "").trim().toLowerCase() === "active-kcal") ?? null;
      const wantsRollup = user.activeKcalRollupEnabled === true;
      const forbidsRollup = user.activeKcalRollupEnabled === false;
      const rollupEnabled =
        !!activeKcal && !forbidsRollup
          ? wantsRollup ||
            (user.activeKcalRollupEnabled == null &&
              !(await prisma.event.findFirst({
                where: { userId: user.id, categoryId: activeKcal.id, kind: "SESSION" },
                select: { id: true },
              })))
          : false;

      const activeKcalSums: { today: number; week: number; month: number; year: number } | null = rollupEnabled
        ? (() => ({ today: 0, week: 0, month: 0, year: 0 }))()
        : null;

      if (rollupEnabled && activeKcalSums && activeKcal) {
        const contributorCats = await prisma.category.findMany({
          where: {
            userId: user.id,
            sourceArchivedAt: null,
            rollupToActiveKcal: true,
            NOT: { id: activeKcal.id },
          },
          select: { id: true, unit: true },
        });
        const rollupMetaById = new Map<string, { unit: string | null; isActive: boolean }>();
        rollupMetaById.set(activeKcal.id, { unit: "kcal", isActive: true });
        for (const c of contributorCats) {
          rollupMetaById.set(String(c.id), { unit: normalizedUnit(c.unit), isActive: false });
        }

        const rollupIds = [activeKcal.id, ...contributorCats.map((c) => String(c.id))];
        const events = await prisma.event.findMany({
          where: {
            userId: user.id,
            kind: "SESSION",
            categoryId: { in: rollupIds },
            occurredOn: { gte: yearStart, lte: today },
          },
          select: { categoryId: true, amount: true, data: true, occurredOn: true },
          take: 20000,
        });

        for (const ev of events) {
          const meta = rollupMetaById.get(String(ev.categoryId ?? ""));
          if (!meta) continue;
          const amount = typeof ev.amount === "number" && Number.isFinite(ev.amount) ? ev.amount : 0;
          const kcal = meta.isActive ? amount : meta.unit === "kcal" ? amount : getNumberField(ev.data, "kcal") ?? 0;
          if (!(kcal > 0)) continue;
          const on = ev.occurredOn instanceof Date ? ev.occurredOn : new Date(ev.occurredOn as any);
          const t = on.getTime();
          if (t >= today.getTime()) activeKcalSums.today += kcal;
          if (t >= weekStart.getTime()) activeKcalSums.week += kcal;
          if (t >= monthStart.getTime()) activeKcalSums.month += kcal;
          if (t >= yearStart.getTime()) activeKcalSums.year += kcal;
        }
      }

      const outCategories = await Promise.all(
        ordered.map(async (c) => {
          const aggregation =
            (c.bucketAggregation ?? "").trim().toLowerCase() === "last" || (c.chartType ?? "").trim().toLowerCase() === "line"
              ? "last"
              : "sum";

          const isActiveKcal = String(c.slug ?? "").trim().toLowerCase() === "active-kcal";
          const rollupEnabledForThis = isActiveKcal && rollupEnabled;

          const idsForSum = [c.id];

          const [todayVal, weekVal, monthVal, yearVal] =
            aggregation === "last"
              ? await Promise.all([
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: today, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: weekStart, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: monthStart, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: yearStart, to: today }),
                ])
              : rollupEnabledForThis && aggregation === "sum" && activeKcalSums
                ? [activeKcalSums.today, activeKcalSums.week, activeKcalSums.month, activeKcalSums.year]
                : await Promise.all([
                    getSumAmountInRangeMany({ userId: user.id, categoryIds: idsForSum, from: today, to: today }),
                    getSumAmountInRangeMany({ userId: user.id, categoryIds: idsForSum, from: weekStart, to: today }),
                    getSumAmountInRangeMany({ userId: user.id, categoryIds: idsForSum, from: monthStart, to: today }),
                    getSumAmountInRangeMany({ userId: user.id, categoryIds: idsForSum, from: yearStart, to: today }),
                  ]);

          return {
            slug: typeof c.slug === "string" && c.slug.trim() ? c.slug : null,
            title: c.title,
            unit: c.unit ?? null,
            aggregation,
            today: todayVal ?? 0,
            week: weekVal ?? 0,
            month: monthVal ?? 0,
            year: yearVal ?? 0,
          };
        }),
      );

      res.status(200).end(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          aggregation: "auto",
          calendar,
          categories: outCategories,
        }),
      );
    } catch (_e: any) {
      res.status(500).end(JSON.stringify({ error: "server_error" }));
    }
  });
}

export const setupPublicStatsRoutes: ServerSetupFn = async ({ app }) => {
  addPublicStatsRoutes(app as any);
};
