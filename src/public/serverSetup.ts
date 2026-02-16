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

      const outCategories = await Promise.all(
        ordered.map(async (c) => {
          const aggregation =
            (c.bucketAggregation ?? "").trim().toLowerCase() === "last" || (c.chartType ?? "").trim().toLowerCase() === "line"
              ? "last"
              : "sum";

          const isActiveKcal = String(c.slug ?? "").trim().toLowerCase() === "active-kcal";
          const wantsRollup = user.activeKcalRollupEnabled === true;
          const forbidsRollup = user.activeKcalRollupEnabled === false;
          const rollupEnabled =
            isActiveKcal && !forbidsRollup
              ? wantsRollup ||
                (user.activeKcalRollupEnabled == null &&
                  !(await prisma.event.findFirst({
                    where: { userId: user.id, categoryId: c.id, kind: "SESSION" },
                    select: { id: true },
                  })))
              : false;

          const contributorIds =
            rollupEnabled && aggregation === "sum"
              ? (
                  await prisma.category.findMany({
                    where: {
                      userId: user.id,
                      sourceArchivedAt: null,
                      rollupToActiveKcal: true,
                      unit: { equals: "kcal", mode: "insensitive" },
                      NOT: { id: c.id },
                    },
                    select: { id: true },
                  })
                ).map((x) => String(x.id))
              : [];
          const idsForSum = rollupEnabled && aggregation === "sum" ? [c.id, ...contributorIds] : [c.id];

          const [todayVal, weekVal, monthVal, yearVal] =
            aggregation === "last"
              ? await Promise.all([
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: today, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: weekStart, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: monthStart, to: today }),
                  getLastAmountInRange({ userId: user.id, categoryId: c.id, from: yearStart, to: today }),
                ])
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
