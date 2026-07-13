import { prisma, HttpError } from "wasp/server";
import type { ExportMyData } from "wasp/server/operations";

type MemoatoExport = {
  schemaVersion: 2;
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
    source: string;
    categoryId: string | null;
    amount: number | null;
    duration: number | null;
    rawText: string | null;
    data: any;
    occurredAt: string;
    occurredOn: string;
    createdAt: string;
    updatedAt: string;
  }>;
  memory: {
    facts: any[];
    processingRuns: any[];
    corrections: any[];
    aliases: any[];
    entities: any[];
    inferences: any[];
  };
};

function parseProviderData(providerData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(providerData);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export const exportMyData: ExportMyData<void, MemoatoExport> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const userId = context.user.id;

  const user = await context.entities.User.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
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
        where: { providerName: { in: ["email", "google"] } },
        select: {
          providerName: true,
          providerUserId: true,
          providerData: true,
        },
      },
    },
  });
  const identities = auth?.identities ?? [];
  const emailIdentity =
    identities.find((i) => i.providerName === "email") ?? null;

  const emailFromUser = user.email?.trim().toLowerCase() ?? null;
  const emailFromEmailIdentity =
    emailIdentity?.providerUserId?.trim().toLowerCase() ?? null;
  const email = emailFromUser || emailFromEmailIdentity || null;

  const providerData = parseProviderData(emailIdentity?.providerData ?? "{}");
  const isEmailVerified = emailIdentity
    ? providerData.isEmailVerified === true
    : true;

  const [
    categories,
    events,
    facts,
    processingRuns,
    corrections,
    aliases,
    entities,
    inferences,
  ] = await Promise.all([
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
        source: true,
        categoryId: true,
        amount: true,
        duration: true,
        rawText: true,
        data: true,
        occurredAt: true,
        occurredOn: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ occurredAt: "asc" }],
    }),
    prisma.memoryFact.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.memoryProcessingRun.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.memoryCorrection.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.memoryAlias.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.memoryEntity.findMany({
      where: { userId },
      include: { facts: true },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.memoryInference.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  return {
    schemaVersion: 2,
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
      sourceArchivedAt: c.sourceArchivedAt
        ? c.sourceArchivedAt.toISOString()
        : null,
    })),
    events: events.map((e: any) => ({
      id: e.id,
      kind: String(e.kind),
      source: e.source,
      categoryId: e.categoryId ?? null,
      amount: e.amount ?? null,
      duration: e.duration ?? null,
      rawText: e.rawText ?? null,
      data: e.data ?? null,
      occurredAt: e.occurredAt.toISOString(),
      occurredOn: (() => {
        const d = e.occurredOn;
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    memory: {
      facts,
      processingRuns,
      corrections,
      aliases,
      entities,
      inferences,
    },
  };
};
