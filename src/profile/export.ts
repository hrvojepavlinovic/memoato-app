import { prisma, HttpError } from "wasp/server";
import type { ExportMyData } from "wasp/server/operations";

type MemoatoExport = {
  exportedAt: string;
  user: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
    email: string | null;
    isEmailVerified: boolean;
  };
  categories: Array<{
    id: string;
    title: string;
    slug: string | null;
    categoryType: string;
    chartType: string | null;
    period: string | null;
    unit: string | null;
    accentHex: string;
    emoji: string | null;
    goalWeekly: number | null;
    goalValue: number | null;
    createdAt: string;
    updatedAt: string;
    sourceArchivedAt: string | null;
  }>;
  events: Array<{
    id: string;
    kind: string;
    categoryId: string | null;
    amount: number | null;
    rawText: string | null;
    occurredAt: string;
    occurredOn: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

function parseProviderData(providerData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(providerData);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const exportMyData: ExportMyData<void, MemoatoExport> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const userId = context.user.id;

  const user = await context.entities.User.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) throw new HttpError(404);

  const auth = await prisma.auth.findFirst({
    where: { userId },
    select: {
      identities: {
        where: { providerName: "email" },
        select: { providerUserId: true, providerData: true },
        take: 1,
      },
    },
  });
  const identity = auth?.identities?.[0] ?? null;
  const email = identity?.providerUserId?.trim().toLowerCase() ?? null;
  const providerData = parseProviderData(identity?.providerData ?? "{}");
  const isEmailVerified = providerData.isEmailVerified === true;

  const [categories, events] = await Promise.all([
    context.entities.Category.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        slug: true,
        categoryType: true,
        chartType: true,
        period: true,
        unit: true,
        accentHex: true,
        emoji: true,
        goalWeekly: true,
        goalValue: true,
        createdAt: true,
        updatedAt: true,
        sourceArchivedAt: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    context.entities.Event.findMany({
      where: { userId },
      select: {
        id: true,
        kind: true,
        categoryId: true,
        amount: true,
        rawText: true,
        occurredAt: true,
        occurredOn: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ occurredAt: "asc" }],
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      role: user.role ?? "user",
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      email: email && email.includes("@") ? email : null,
      isEmailVerified,
    },
    categories: categories.map((c: any) => ({
      id: c.id,
      title: c.title,
      slug: c.slug ?? null,
      categoryType: String(c.categoryType),
      chartType: c.chartType ?? null,
      period: c.period ?? null,
      unit: c.unit ?? null,
      accentHex: c.accentHex,
      emoji: c.emoji ?? null,
      goalWeekly: c.goalWeekly ?? null,
      goalValue: c.goalValue ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      sourceArchivedAt: c.sourceArchivedAt ? c.sourceArchivedAt.toISOString() : null,
    })),
    events: events.map((e: any) => ({
      id: e.id,
      kind: String(e.kind),
      categoryId: e.categoryId ?? null,
      amount: e.amount ?? null,
      rawText: e.rawText ?? null,
      occurredAt: e.occurredAt.toISOString(),
      occurredOn: (() => {
        const d = e.occurredOn;
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  };
};
