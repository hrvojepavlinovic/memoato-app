import { HttpError, prisma } from "wasp/server";
import type {
  GetMemoryFeed,
  GetMemoryOverview,
  RecallMemory,
  RetryMemoryEntry,
  ReviewMemoryFact,
} from "wasp/server/operations";
import { isOpenRouterExtractorConfigured } from "./openRouterExtractor";
import { queueMemoryReprocessing } from "./ingest";
import { searchMemoryTerms } from "./recallTerms";

const MAX_FEED_TAKE = 50;
const DEFAULT_FEED_TAKE = 20;

function clampTake(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FEED_TAKE;
  return Math.max(1, Math.min(MAX_FEED_TAKE, Math.floor(parsed)));
}

function memoryData(data: any): any {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data.memoatoMemory ?? {})
    : {};
}

function legacyFacts(data: any): any[] {
  const facts = memoryData(data)?.extraction?.facts;
  return Array.isArray(facts)
    ? facts.filter((fact) => fact && typeof fact === "object")
    : [];
}

function factDto(fact: any) {
  return {
    id: fact.id,
    kind: fact.kind,
    label: fact.label,
    canonical: fact.canonical,
    amount: fact.amount,
    unit: fact.unit,
    durationMinutes: fact.durationMinutes,
    confidence: fact.confidence,
    origin: fact.origin,
    status: fact.status,
    category: fact.category
      ? {
          id: fact.category.id,
          title: fact.category.title,
          slug: fact.category.slug,
        }
      : null,
    data: fact.data,
  };
}

function entryDto(event: any) {
  const memory = memoryData(event.data);
  const normalized = Array.isArray(event.rawMemoryFacts)
    ? event.rawMemoryFacts.map(factDto)
    : [];
  const fallback =
    normalized.length === 0
      ? legacyFacts(event.data).map((fact, index) => ({
          id: `legacy:${event.id}:${index}`,
          kind: fact.kind ?? "note",
          label: fact.label ?? fact.canonical ?? "Memory",
          canonical: fact.canonical ?? null,
          amount: typeof fact.amount === "number" ? fact.amount : null,
          unit: typeof fact.unit === "string" ? fact.unit : null,
          durationMinutes:
            typeof fact.durationMinutes === "number"
              ? fact.durationMinutes
              : null,
          confidence:
            typeof fact.confidence === "number" ? fact.confidence : 0.5,
          origin: memory?.extraction?.parser ?? "legacy",
          status:
            typeof fact.confidence === "number" && fact.confidence < 0.85
              ? "needs_review"
              : "accepted",
          category: null,
          data: { fact, legacy: true },
        }))
      : [];

  return {
    id: event.id,
    rawText: event.rawText ?? "",
    source: memory.source ?? event.source,
    tags: Array.isArray(memory.tags) ? memory.tags : [],
    processingStatus: memory.processingStatus ?? "complete",
    processingError: memory.processingError ?? null,
    occurredAt: event.occurredAt,
    createdAt: event.createdAt,
    facts: normalized.length > 0 ? normalized : fallback,
  };
}

const memoryFactSelect: any = {
  id: true,
  kind: true,
  label: true,
  canonical: true,
  amount: true,
  unit: true,
  durationMinutes: true,
  confidence: true,
  origin: true,
  status: true,
  data: true,
  category: { select: { id: true, title: true, slug: true } },
};

const memoryEntrySelect: any = {
  id: true,
  source: true,
  rawText: true,
  data: true,
  occurredAt: true,
  createdAt: true,
  rawMemoryFacts: {
    select: memoryFactSelect,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  },
};

export const getMemoryOverview: GetMemoryOverview<void, any> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const userId = context.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [capturedToday, reviewCount, failedCount, recent] = await Promise.all([
    prisma.event.count({
      where: { userId, kind: "NOTE", occurredAt: { gte: today } },
    }),
    prisma.memoryFact.count({ where: { userId, status: "needs_review" } }),
    prisma.event.count({
      where: {
        userId,
        kind: "NOTE",
        data: { path: ["memoatoMemory", "processingStatus"], equals: "failed" },
      },
    }),
    prisma.event.findMany({
      where: { userId, kind: "NOTE" },
      select: memoryEntrySelect,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 4,
    }),
  ]);

  return {
    capturedToday,
    reviewCount,
    failedCount,
    recent: recent.map(entryDto),
    processing: {
      openRouterConfigured: isOpenRouterExtractorConfigured(),
      mode: isOpenRouterExtractorConfigured() ? "hybrid" : "on-device-rules",
      model: String(
        process.env.MEMOATO_AI_MODEL ?? "google/gemini-3.1-flash-lite",
      ),
    },
  };
};

type MemoryFeedArgs = {
  filter?: "all" | "review" | "failed";
  take?: number;
  before?: string;
};

export const getMemoryFeed: GetMemoryFeed<MemoryFeedArgs, any> = async (
  args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const filter =
    args?.filter === "review" || args?.filter === "failed"
      ? args.filter
      : "all";
  const before = args?.before ? new Date(args.before) : null;
  const validBefore = before && !Number.isNaN(before.getTime()) ? before : null;
  const where: any = {
    userId: context.user.id,
    kind: "NOTE",
    ...(validBefore ? { occurredAt: { lt: validBefore } } : {}),
  };
  if (filter === "review")
    where.rawMemoryFacts = { some: { status: "needs_review" } };
  if (filter === "failed")
    where.data = {
      path: ["memoatoMemory", "processingStatus"],
      equals: "failed",
    };

  const take = clampTake(args?.take);
  const rows = await prisma.event.findMany({
    where,
    select: memoryEntrySelect,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const entries = rows.slice(0, take).map(entryDto);
  return {
    filter,
    entries,
    nextBefore: hasMore
      ? (entries[entries.length - 1]?.occurredAt ?? null)
      : null,
  };
};

type RecallArgs = { query: string; take?: number };

export const recallMemory: RecallMemory<RecallArgs, any> = async (
  args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const query = String(args?.query ?? "")
    .trim()
    .slice(0, 240);
  const terms = searchMemoryTerms(query);
  const take = clampTake(args?.take);
  const termConditions: any[] = terms.map((term) => ({
    OR: [
      { rawText: { contains: term, mode: "insensitive" } },
      {
        rawMemoryFacts: {
          some: {
            label: { contains: term, mode: "insensitive" },
            status: { not: "rejected" },
          },
        },
      },
      {
        rawMemoryFacts: {
          some: {
            canonical: { contains: term, mode: "insensitive" },
            status: { not: "rejected" },
          },
        },
      },
    ],
  }));

  const [rawRows, legacyRows] = await Promise.all([
    prisma.event.findMany({
      where: {
        userId: context.user.id,
        kind: "NOTE",
        ...(termConditions.length > 0 ? { AND: termConditions } : {}),
      } as any,
      select: memoryEntrySelect,
      orderBy: [{ occurredAt: "desc" }],
      take,
    }),
    prisma.event.findMany({
      where: {
        userId: context.user.id,
        kind: "SESSION",
        ...(terms.length > 0
          ? {
              AND: terms.map((term) => ({
                OR: [
                  { rawText: { contains: term, mode: "insensitive" } },
                  {
                    category: {
                      title: { contains: term, mode: "insensitive" },
                    },
                  },
                  {
                    category: { slug: { contains: term, mode: "insensitive" } },
                  },
                ],
              })),
            }
          : {}),
      } as any,
      select: {
        id: true,
        source: true,
        rawText: true,
        amount: true,
        duration: true,
        data: true,
        occurredAt: true,
        createdAt: true,
        category: { select: { id: true, title: true, slug: true, unit: true } },
      },
      orderBy: [{ occurredAt: "desc" }],
      take,
    }),
  ]);

  const rawIds = new Set<string>(
    (rawRows as any[]).map((row: any) => String(row.id)),
  );
  const entries: any[] = rawRows.map(entryDto);
  for (const event of legacyRows) {
    const rawEntryId = (event?.data as any)?.rawEntryId;
    if (typeof rawEntryId === "string" && rawIds.has(rawEntryId)) continue;
    if (typeof rawEntryId === "string") continue;
    entries.push({
      id: event.id,
      rawText: event.rawText || event.category?.title || "Legacy entry",
      source: event.source,
      tags: [],
      processingStatus: "legacy",
      processingError: null,
      occurredAt: event.occurredAt,
      createdAt: event.createdAt,
      facts: [
        {
          id: `event:${event.id}`,
          kind: "metric",
          label: event.category?.title ?? "Memory",
          canonical: event.category?.title ?? null,
          amount: event.amount,
          unit: event.category?.unit ?? null,
          durationMinutes: event.duration,
          confidence: 1,
          origin: "legacy",
          status: "accepted",
          category: event.category,
          data: event.data,
        },
      ],
    });
  }
  entries.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const acceptedFacts = entries
    .flatMap((entry) =>
      entry.facts.map((fact: any) => ({
        ...fact,
        occurredAt: entry.occurredAt,
      })),
    )
    .filter(
      (fact) => fact.status !== "rejected" && typeof fact.amount === "number",
    );
  const group = new Map<string, any[]>();
  for (const fact of acceptedFacts) {
    const key = `${String(fact.canonical ?? fact.label).toLowerCase()}|${fact.unit ?? ""}`;
    group.set(key, [...(group.get(key) ?? []), fact]);
  }
  const strongest =
    Array.from(group.values()).sort((a, b) => b.length - a.length)[0] ?? [];
  const latest = strongest[0] ?? null;

  return {
    query,
    terms,
    count: Math.min(entries.length, take),
    entries: entries.slice(0, take),
    signal: latest
      ? {
          label: latest.canonical ?? latest.label,
          latestValue: latest.amount,
          unit: latest.unit,
          latestAt: latest.occurredAt,
          sampleCount: strongest.length,
        }
      : null,
  };
};

type ReviewArgs = {
  factId: string;
  action: "accept" | "reject" | "edit";
  label?: string;
  canonical?: string;
  amount?: number | null;
  unit?: string | null;
};

function cleanOptional(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  const cleaned = String(value ?? "")
    .trim()
    .slice(0, max);
  return cleaned || null;
}

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const reviewMemoryFact: ReviewMemoryFact<ReviewArgs, any> = async (
  args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  if (!args || !["accept", "reject", "edit"].includes(args.action))
    throw new HttpError(400, "Invalid action");
  const fact = await prisma.memoryFact.findFirst({
    where: { id: String(args.factId ?? ""), userId: context.user.id },
    include: {
      rawEntry: {
        select: {
          id: true,
          source: true,
          rawText: true,
          occurredAt: true,
          occurredOn: true,
        },
      },
      category: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!fact) throw new HttpError(404);

  const before = {
    label: fact.label,
    canonical: fact.canonical,
    amount: fact.amount,
    unit: fact.unit,
    status: fact.status,
  };
  const label = cleanOptional(args.label, 160);
  const canonical = cleanOptional(args.canonical, 160);
  const unit = cleanOptional(args.unit, 32);
  const amount =
    args.amount === undefined
      ? undefined
      : args.amount === null
        ? null
        : typeof args.amount === "number" && Number.isFinite(args.amount)
          ? args.amount
          : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    let result: any;
    const storedIds = Array.isArray((fact.data as any)?.derivedEventIds)
      ? (fact.data as any).derivedEventIds
      : [];
    const derivedIds = Array.from(
      new Set(
        [fact.derivedEventId, ...storedIds].filter(
          (id): id is string => typeof id === "string",
        ),
      ),
    );
    if (args.action === "reject") {
      if (derivedIds.length > 0) {
        await tx.event.deleteMany({
          where: { id: { in: derivedIds }, userId: context.user!.id },
        });
      }
      result = await tx.memoryFact.update({
        where: { id: fact.id },
        data: {
          status: "rejected",
          derivedEventId: null,
          data: { ...((fact.data as any) ?? {}), derivedEventIds: [] },
        },
      });
    } else {
      const data: any = { status: "accepted" };
      if (args.action === "edit") {
        if (label !== undefined) data.label = label ?? fact.label;
        if (canonical !== undefined) data.canonical = canonical;
        if (unit !== undefined) data.unit = unit;
        if (amount !== undefined) data.amount = amount;
        data.origin = "human";
        data.confidence = 1;

        const storedFact = (fact.data as any)?.fact ?? {};
        const correctedFact = JSON.parse(
          JSON.stringify({
            ...storedFact,
            label: label ?? fact.label,
            canonical: canonical === undefined ? fact.canonical : canonical,
            amount: amount === undefined ? fact.amount : amount,
            unit: unit === undefined ? fact.unit : unit,
            confidence: 1,
            origin: "human",
            ...(amount !== undefined ? { setValues: undefined } : {}),
          }),
        );
        data.data = {
          ...((fact.data as any) ?? {}),
          fact: correctedFact,
          derivedEventIds: derivedIds,
        };

        if (amount !== undefined) {
          if (amount === null) {
            if (derivedIds.length > 0) {
              await tx.event.deleteMany({
                where: { id: { in: derivedIds }, userId: context.user!.id },
              });
            }
            data.derivedEventId = null;
            data.data.derivedEventIds = [];
          } else if (derivedIds.length === 1) {
            await tx.event.updateMany({
              where: { id: derivedIds[0], userId: context.user!.id },
              data: { amount },
            });
          } else if (fact.category) {
            if (derivedIds.length > 0) {
              await tx.event.deleteMany({
                where: { id: { in: derivedIds }, userId: context.user!.id },
              });
            }
            const replacement = await tx.event.create({
              data: {
                userId: context.user!.id,
                source: fact.rawEntry.source,
                kind: "SESSION",
                categoryId: fact.category.id,
                rawText: fact.rawEntry.rawText,
                amount,
                duration: fact.durationMinutes
                  ? Math.round(fact.durationMinutes)
                  : null,
                occurredAt: fact.rawEntry.occurredAt,
                occurredOn: fact.rawEntry.occurredOn,
                data: {
                  source: "memoato-memory",
                  rawEntryId: fact.rawEntryId,
                  rawText: fact.rawEntry.rawText,
                  fact: correctedFact,
                  category: fact.category,
                  correction: true,
                },
              },
              select: { id: true },
            });
            data.derivedEventId = replacement.id;
            data.data.derivedEventIds = [replacement.id];
          }
        }
      }
      result = await tx.memoryFact.update({ where: { id: fact.id }, data });
    }

    const after = {
      label: result.label,
      canonical: result.canonical,
      amount: result.amount,
      unit: result.unit,
      status: result.status,
    };
    await tx.memoryCorrection.create({
      data: {
        userId: context.user!.id,
        rawEntryId: fact.rawEntryId,
        factId: fact.id,
        action: args.action,
        before,
        after,
      },
    });

    if (args.action === "edit" && before.label !== after.label) {
      const phrase = normalizeAlias(before.label);
      const target = after.canonical || after.label;
      if (phrase && target) {
        await tx.memoryAlias.upsert({
          where: {
            userId_normalizedPhrase: {
              userId: context.user!.id,
              normalizedPhrase: phrase,
            },
          },
          create: {
            userId: context.user!.id,
            categoryId: fact.categoryId,
            phrase: before.label,
            normalizedPhrase: phrase,
            canonical: target,
            kind: fact.kind,
            source: "correction",
          },
          update: {
            canonical: target,
            categoryId: fact.categoryId,
            kind: fact.kind,
            phrase: before.label,
          },
        });
      }
    }
    return result;
  });
  return factDto({ ...updated, category: null });
};

type RetryArgs = { rawEntryId: string };

export const retryMemoryEntry: RetryMemoryEntry<RetryArgs, any> = async (
  args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  await queueMemoryReprocessing({
    prisma,
    rawEntryId: String(args?.rawEntryId ?? ""),
    userId: context.user.id,
  });
  return { rawEntryId: args.rawEntryId, processingStatus: "queued" };
};
