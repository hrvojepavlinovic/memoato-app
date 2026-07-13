import type {
  CategoryLite,
  CreateRawEntryRequest,
  MemoryExtraction,
  MemoryFact,
} from "./types";
import { extractDeterministicMemoryFacts } from "./extract";
import {
  extractWithOpenRouter,
  isOpenRouterExtractorConfigured,
} from "./openRouterExtractor";
import { hashApiKeyToken, scopeAllowsRawEntryWrite } from "./apiKeys";
import { createHash, randomUUID } from "node:crypto";

type PrismaLike = any;

const API_SOURCE = "mcp";
const MIN_AUTO_MATCH_CONFIDENCE = 0.85;

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function occurredOnFromDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseOccurredAt(input: unknown): Date {
  if (typeof input !== "string" || !input.trim()) return new Date();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseNumber(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  return input;
}

function parseClientLabels(input: unknown): MemoryFact[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (value) => value && typeof value === "object" && !Array.isArray(value),
    )
    .map((value): MemoryFact | null => {
      const raw = value as Record<string, unknown>;
      const kindRaw = String(raw.kind ?? "")
        .trim()
        .toLowerCase();
      const kind: MemoryFact["kind"] =
        kindRaw === "movement" ||
        kindRaw === "metric" ||
        kindRaw === "energy" ||
        kindRaw === "context" ||
        kindRaw === "note"
          ? kindRaw
          : "note";
      const label = String(raw.label ?? raw.canonical ?? "").trim();
      if (!label) return null;
      const categoryCandidates = parseStringArray(raw.categoryCandidates);
      const setValues = Array.isArray(raw.setValues)
        ? raw.setValues
            .filter(
              (n): n is number =>
                typeof n === "number" && Number.isFinite(n) && n > 0,
            )
            .slice(0, 30)
        : undefined;
      const confidence = parseNumber(raw.confidence);
      const fact: MemoryFact = {
        kind,
        label,
        confidence:
          confidence == null ? 0.9 : Math.max(0, Math.min(1, confidence)),
        origin: "client",
      };
      if (typeof raw.categoryId === "string" && raw.categoryId.trim())
        fact.categoryId = raw.categoryId.trim();
      if (typeof raw.canonical === "string" && raw.canonical.trim())
        fact.canonical = raw.canonical.trim();
      if (categoryCandidates.length > 0)
        fact.categoryCandidates = categoryCandidates;
      const amount = parseNumber(raw.amount);
      if (amount != null) fact.amount = amount;
      if (typeof raw.unit === "string" && raw.unit.trim())
        fact.unit = raw.unit.trim();
      const durationMinutes = parseNumber(raw.durationMinutes);
      if (durationMinutes != null) fact.durationMinutes = durationMinutes;
      const sets = parseNumber(raw.sets);
      if (sets != null) fact.sets = sets;
      const reps = parseNumber(raw.reps);
      if (reps != null) fact.reps = reps;
      if (setValues && setValues.length > 0) fact.setValues = setValues;
      if (typeof raw.note === "string" && raw.note.trim())
        fact.note = raw.note.trim();
      return fact;
    })
    .filter((fact): fact is MemoryFact => !!fact)
    .slice(0, 30);
}

export function parseCreateRawEntryRequest(
  body: unknown,
): CreateRawEntryRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid_body");
  }
  const text = String((body as any).text ?? "").trim();
  if (text.length < 1) throw new Error("missing_text");
  if (text.length > 4000) throw new Error("text_too_long");
  return {
    text,
    occurredAt:
      typeof (body as any).occurredAt === "string"
        ? (body as any).occurredAt
        : undefined,
    source:
      typeof (body as any).source === "string"
        ? (body as any).source.trim().slice(0, 80)
        : undefined,
    tags: parseStringArray((body as any).tags),
    labels: parseClientLabels((body as any).labels),
  };
}

export function isAuthorizedRawEntryRequest(req: any): boolean {
  const configuredToken = env("MEMOATO_MCP_TOKEN");
  if (!configuredToken) return false;
  const header = String(
    req?.headers?.authorization ?? req?.headers?.Authorization ?? "",
  ).trim();
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return token.length > 0 && token === configuredToken;
}

function getBearerToken(req: any): string | null {
  const header = String(
    req?.headers?.authorization ?? req?.headers?.Authorization ?? "",
  ).trim();
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return token.length > 0 ? token : null;
}

export async function authenticateRawEntryRequest(
  prisma: PrismaLike,
  req: any,
): Promise<{ userId: string; apiKeyId: string | null } | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { tokenHash: hashApiKeyToken(token) },
    select: {
      id: true,
      userId: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (apiKey) {
    const now = new Date();
    if (apiKey.revokedAt) return null;
    if (
      apiKey.expiresAt &&
      new Date(apiKey.expiresAt).getTime() <= now.getTime()
    )
      return null;
    if (!scopeAllowsRawEntryWrite(apiKey.scope)) return null;

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: now },
    });
    return { userId: apiKey.userId, apiKeyId: apiKey.id };
  }

  // Legacy bootstrap path. Prefer database-backed ApiKey records for real use.
  if (isAuthorizedRawEntryRequest(req)) {
    const user = await findIngestUser(prisma);
    if (!user) return null;
    return { userId: user.id, apiKeyId: null };
  }

  return null;
}

async function findIngestUser(prisma: PrismaLike) {
  const id = env("MEMOATO_MCP_USER_ID");
  if (id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (user) return user;
  }

  const email = env("MEMOATO_MCP_USER_EMAIL").toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) return user;
  }

  const username = env("MEMOATO_MCP_USERNAME");
  if (username) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (user) return user;
  }

  return null;
}

async function listCategories(
  prisma: PrismaLike,
  userId: string,
): Promise<CategoryLite[]> {
  return prisma.category.findMany({
    where: { userId, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true },
    orderBy: [{ title: "asc" }],
  });
}

async function ensureNotesCategory(
  prisma: PrismaLike,
  userId: string,
  categories: CategoryLite[],
): Promise<CategoryLite> {
  const fromCache = categories.find(
    (category) => normalizeKey(category.slug ?? category.title) === "notes",
  );
  if (fromCache) return fromCache;

  const existing = await prisma.category.findFirst({
    where: { userId, slug: "notes", sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true, isSystem: true },
  });
  if (existing) {
    if (!existing.isSystem) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { isSystem: true },
      });
    }
    return {
      id: existing.id,
      title: existing.title,
      slug: existing.slug,
      unit: existing.unit,
    };
  }

  return prisma.category.create({
    data: {
      userId,
      source: "memoato",
      title: "Notes",
      slug: "notes",
      categoryType: "NUMBER",
      chartType: "bar",
      period: "day",
      accentHex: "#0A0A0A",
      kind: "note",
      type: "Simple",
      isSystem: true,
    },
    select: { id: true, title: true, slug: true, unit: true },
  });
}

function mergeExtractions(
  primary: MemoryExtraction,
  fallback: MemoryExtraction | null,
): MemoryExtraction {
  if (!fallback || fallback.facts.length === 0) return primary;
  if (primary.facts.length === 0) return { ...fallback, parser: "hybrid" };

  const seen = new Set(
    primary.facts.map((fact) => normalizeKey(fact.canonical ?? fact.label)),
  );
  const extraFacts = fallback.facts.filter(
    (fact) => !seen.has(normalizeKey(fact.canonical ?? fact.label)),
  );
  return {
    parser: "hybrid",
    parserVersion: `${primary.parserVersion}+${fallback.parserVersion}`,
    facts: [...primary.facts, ...extraFacts],
    unknowns: Array.from(new Set([...primary.unknowns, ...fallback.unknowns])),
    provider: fallback.provider ?? primary.provider,
    model: fallback.model ?? primary.model,
    latencyMs: fallback.latencyMs ?? primary.latencyMs,
  };
}

type MemoryAliasLite = {
  normalizedPhrase: string;
  canonical: string;
  categoryId: string | null;
};

async function listAliases(
  prisma: PrismaLike,
  userId: string,
): Promise<MemoryAliasLite[]> {
  return prisma.memoryAlias.findMany({
    where: { userId },
    select: { normalizedPhrase: true, canonical: true, categoryId: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
}

function isCategorizedFact(fact: MemoryFact): boolean {
  return fact.kind === "movement" || fact.kind === "metric";
}

function matchCategory(
  fact: MemoryFact,
  categories: CategoryLite[],
  aliases: MemoryAliasLite[],
): CategoryLite | null {
  if (fact.confidence < MIN_AUTO_MATCH_CONFIDENCE) return null;

  if (fact.categoryId) {
    const byId = categories.find((category) => category.id === fact.categoryId);
    if (byId) return byId;
  }

  const wanted = [
    fact.canonical,
    fact.label,
    ...(fact.categoryCandidates ?? []),
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(normalizeKey);

  for (const alias of aliases) {
    if (!wanted.includes(alias.normalizedPhrase)) continue;
    if (alias.categoryId) {
      const category = categories.find((item) => item.id === alias.categoryId);
      if (category) return category;
    }
    wanted.push(normalizeKey(alias.canonical));
  }

  for (const category of categories) {
    const keys = [category.title, category.slug]
      .map(normalizeKey)
      .filter(Boolean);
    if (keys.some((key) => wanted.includes(key))) return category;
  }

  return null;
}

function categoryTitleForFact(fact: MemoryFact): string {
  const raw = String(fact.canonical || fact.label || "Untitled").trim();
  if (!raw) return "Untitled";
  return raw
    .split(/\s+/)
    .map((part) =>
      part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

function categoryUnitForFact(fact: MemoryFact): string | null {
  const unit = String(fact.unit ?? "").trim();
  return unit || null;
}

async function findOrCreateCategoryForFact(
  prisma: PrismaLike,
  userId: string,
  fact: MemoryFact,
  categories: CategoryLite[],
  aliases: MemoryAliasLite[],
): Promise<CategoryLite | null> {
  const matched = matchCategory(fact, categories, aliases);
  if (matched) return matched;

  if (!isCategorizedFact(fact) || fact.confidence < MIN_AUTO_MATCH_CONFIDENCE)
    return null;

  const title = categoryTitleForFact(fact);
  const slug = normalizeKey(title);
  if (!slug) return null;

  const existing = await prisma.category.findFirst({
    where: { userId, slug, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true },
  });
  if (existing) {
    const category = {
      id: existing.id,
      title: existing.title,
      slug: existing.slug,
      unit: existing.unit,
    };
    categories.push(category);
    return category;
  }

  const created = await prisma.category.create({
    data: {
      userId,
      source: "memoato",
      title,
      slug,
      unit: categoryUnitForFact(fact),
      categoryType: "NUMBER",
      chartType: "bar",
      period: "day",
      accentHex: "#0A0A0A",
      kind: fact.kind,
      type: "Simple",
    },
    select: { id: true, title: true, slug: true, unit: true },
  });

  categories.push(created);
  return created;
}

function factsForDerivedEvents(fact: MemoryFact): MemoryFact[] {
  const setValues = Array.isArray(fact.setValues)
    ? fact.setValues.filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (setValues.length > 0) {
    return setValues.map((amount, index) => ({
      ...fact,
      amount,
      reps: amount,
      setIndex: index + 1,
      setCount: setValues.length,
      setValues: undefined,
    }));
  }

  return [fact];
}

function dataForDerivedEvent(args: {
  rawEntryId: string;
  fact: MemoryFact;
  category: CategoryLite;
  request: CreateRawEntryRequest;
  apiKeyId?: string | null;
}) {
  return {
    source: "memoato-memory",
    rawEntryId: args.rawEntryId,
    rawText: args.request.text,
    fact: args.fact,
    category: {
      id: args.category.id,
      title: args.category.title,
      slug: args.category.slug,
    },
    tags: args.request.tags ?? [],
    apiKeyId: args.apiKeyId ?? null,
  };
}

function memoatoMemoryData(args: {
  existing?: any;
  request: CreateRawEntryRequest;
  apiKeyId?: string | null;
  processingStatus: "queued" | "processing" | "complete" | "failed";
  extraction?: MemoryExtraction | null;
  derivedEventIds?: string[];
  processingError?: string | null;
}) {
  const previous =
    args.existing && typeof args.existing === "object"
      ? (args.existing.memoatoMemory ?? {})
      : {};
  return {
    memoatoMemory: {
      ...previous,
      source: args.request.source || previous.source || API_SOURCE,
      tags: args.request.tags ?? previous.tags ?? [],
      apiKeyId: args.apiKeyId ?? previous.apiKeyId ?? null,
      processingStatus: args.processingStatus,
      ...(args.extraction ? { extraction: args.extraction } : {}),
      ...(args.derivedEventIds
        ? { derivedEventIds: args.derivedEventIds }
        : {}),
      ...(args.processingError
        ? { processingError: args.processingError }
        : { processingError: null }),
    },
  };
}

function requestFromRawEntry(rawEntry: any): CreateRawEntryRequest {
  const memory = rawEntry?.data?.memoatoMemory;
  return {
    text: String(rawEntry.rawText ?? ""),
    occurredAt:
      rawEntry.occurredAt instanceof Date
        ? rawEntry.occurredAt.toISOString()
        : undefined,
    source:
      typeof memory?.source === "string" ? memory.source : rawEntry.source,
    tags: Array.isArray(memory?.tags)
      ? memory.tags.filter(
          (tag: unknown): tag is string => typeof tag === "string",
        )
      : [],
    labels: Array.isArray(memory?.clientLabels) ? memory.clientLabels : [],
  };
}

function shouldUseOpenRouter(
  rawText: string,
  extraction: MemoryExtraction,
): boolean {
  if (!isOpenRouterExtractorConfigured()) return false;
  if (extraction.facts.length === 0) return true;
  if (
    extraction.facts.some((fact) => fact.confidence < MIN_AUTO_MATCH_CONFIDENCE)
  )
    return true;
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  return (
    words.length >= 7 &&
    /[,.;!?]|\b(?:and|but|because|pa|ali|jer|onda)\b/i.test(rawText)
  );
}

function jsonValue(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function factFingerprint(fact: MemoryFact, position: number): string {
  const stable = JSON.stringify({
    position,
    kind: fact.kind,
    canonical: normalizeKey(fact.canonical ?? fact.label),
    amount: fact.amount ?? null,
    unit: normalizeKey(fact.unit),
    durationMinutes: fact.durationMinutes ?? null,
    setValues: fact.setValues ?? null,
  });
  return createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

function factOrigin(fact: MemoryFact, extraction: MemoryExtraction): string {
  if (fact.origin) return fact.origin;
  return extraction.parser === "hybrid" ? "deterministic" : extraction.parser;
}

async function claimProcessingRun(
  prisma: PrismaLike,
  rawEntry: any,
): Promise<any | null> {
  let run = await prisma.memoryProcessingRun.findFirst({
    where: { rawEntryId: rawEntry.id },
    orderBy: [{ attempt: "desc" }],
  });

  if (!run) {
    run = await prisma.memoryProcessingRun.create({
      data: {
        userId: rawEntry.userId,
        rawEntryId: rawEntry.id,
        attempt: 1,
        status: "queued",
      },
    });
  }

  if (run.status === "complete") return null;
  if (run.status === "processing") {
    const started = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    if (started > Date.now() - 5 * 60_000) return null;
    run = await prisma.memoryProcessingRun.update({
      where: { id: run.id },
      data: { status: "queued" },
    });
  }
  if (run.status === "failed") {
    run = await prisma.memoryProcessingRun.create({
      data: {
        userId: rawEntry.userId,
        rawEntryId: rawEntry.id,
        attempt: run.attempt + 1,
        status: "queued",
      },
    });
  }

  const claimed = await prisma.memoryProcessingRun.updateMany({
    where: { id: run.id, status: "queued" },
    data: {
      status: "processing",
      startedAt: new Date(),
      errorCode: null,
      finishedAt: null,
    },
  });
  return claimed.count === 1 ? { ...run, status: "processing" } : null;
}

export async function processRawMemoryEntry(args: {
  prisma: PrismaLike;
  rawEntryId: string;
}) {
  const rawEntry = await args.prisma.event.findUnique({
    where: { id: args.rawEntryId },
    select: {
      id: true,
      userId: true,
      source: true,
      kind: true,
      rawText: true,
      occurredAt: true,
      occurredOn: true,
      data: true,
    },
  });

  if (
    !rawEntry ||
    rawEntry.kind !== "NOTE" ||
    !rawEntry.userId ||
    !rawEntry.rawText
  ) {
    throw new Error("raw_entry_not_found");
  }

  const request = requestFromRawEntry(rawEntry);
  const apiKeyId = rawEntry?.data?.memoatoMemory?.apiKeyId ?? null;
  const processingRun = await claimProcessingRun(args.prisma, rawEntry);
  if (!processingRun) {
    return {
      rawEntryId: rawEntry.id,
      processingStatus:
        rawEntry?.data?.memoatoMemory?.processingStatus ?? "processing",
      derivedEvents: [],
      extraction: rawEntry?.data?.memoatoMemory?.extraction ?? null,
    };
  }

  try {
    await args.prisma.event.update({
      where: { id: rawEntry.id },
      data: {
        data: memoatoMemoryData({
          existing: rawEntry.data,
          request,
          apiKeyId,
          processingStatus: "processing",
        }),
      },
    });

    const [categories, aliases] = await Promise.all([
      listCategories(args.prisma, rawEntry.userId),
      listAliases(args.prisma, rawEntry.userId),
    ]);
    const clientExtraction: MemoryExtraction | null =
      request.labels && request.labels.length > 0
        ? {
            parser: "client",
            parserVersion: "mcp-client-labels-v1",
            facts: request.labels,
            unknowns: [],
          }
        : null;
    const deterministic = extractDeterministicMemoryFacts(request.text);
    const baseExtraction = clientExtraction
      ? mergeExtractions(clientExtraction, deterministic)
      : deterministic;
    const aiExtraction = shouldUseOpenRouter(request.text, baseExtraction)
      ? await extractWithOpenRouter({ rawText: request.text, categories })
      : null;
    const extraction = mergeExtractions(baseExtraction, aiExtraction);
    const derivedEvents = await args.prisma.$transaction(
      async (tx: PrismaLike) => {
        const createdEvents: Array<{
          id: string;
          categoryId: string | null;
          amount: number | null;
          duration: number | null;
        }> = [];

        // Reprocessing swaps only derived state, and does so atomically. rawText is
        // never deleted or rewritten.
        await tx.memoryFact.deleteMany({ where: { rawEntryId: rawEntry.id } });
        await tx.event.deleteMany({
          where: {
            userId: rawEntry.userId,
            kind: "SESSION",
            data: { path: ["rawEntryId"], equals: rawEntry.id },
          },
        });

        for (const [position, fact] of extraction.facts.entries()) {
          const factDerivedIds: string[] = [];
          const category = isCategorizedFact(fact)
            ? await findOrCreateCategoryForFact(
                tx,
                rawEntry.userId,
                fact,
                categories,
                aliases,
              )
            : null;

          if (category) {
            for (const eventFact of factsForDerivedEvents(fact)) {
              const amount =
                typeof eventFact.amount === "number" &&
                Number.isFinite(eventFact.amount)
                  ? eventFact.amount
                  : 1;
              const ev = await tx.event.create({
                data: {
                  userId: rawEntry.userId,
                  source: request.source || API_SOURCE,
                  kind: "SESSION",
                  categoryId: category.id,
                  rawText: request.text,
                  amount,
                  duration: eventFact.durationMinutes
                    ? Math.round(eventFact.durationMinutes)
                    : null,
                  occurredAt: eventFact.setIndex
                    ? new Date(
                        rawEntry.occurredAt.getTime() +
                          (eventFact.setIndex - 1) * 1000,
                      )
                    : rawEntry.occurredAt,
                  occurredOn: rawEntry.occurredOn,
                  data: dataForDerivedEvent({
                    rawEntryId: rawEntry.id,
                    fact: eventFact,
                    category,
                    request,
                    apiKeyId,
                  }),
                },
                select: {
                  id: true,
                  categoryId: true,
                  amount: true,
                  duration: true,
                },
              });
              createdEvents.push(ev);
              factDerivedIds.push(ev.id);
            }
          }

          await tx.memoryFact.create({
            data: {
              userId: rawEntry.userId,
              rawEntryId: rawEntry.id,
              derivedEventId: factDerivedIds[0] ?? null,
              categoryId: category?.id ?? null,
              position,
              fingerprint: factFingerprint(fact, position),
              kind: fact.kind,
              label: fact.label,
              canonical: fact.canonical ?? null,
              amount:
                typeof fact.amount === "number" && Number.isFinite(fact.amount)
                  ? fact.amount
                  : null,
              unit: fact.unit ?? null,
              durationMinutes:
                typeof fact.durationMinutes === "number" &&
                Number.isFinite(fact.durationMinutes)
                  ? fact.durationMinutes
                  : null,
              confidence: Math.max(0, Math.min(1, fact.confidence)),
              origin: factOrigin(fact, extraction),
              status:
                fact.confidence >= MIN_AUTO_MATCH_CONFIDENCE
                  ? "accepted"
                  : "needs_review",
              data: jsonValue({ fact, derivedEventIds: factDerivedIds }),
              evidence: { source: "raw_entry" },
            },
          });
        }

        if (createdEvents.length === 0) {
          const notes = await ensureNotesCategory(
            tx,
            rawEntry.userId,
            categories,
          );
          const ev = await tx.event.create({
            data: {
              userId: rawEntry.userId,
              source: request.source || API_SOURCE,
              kind: "SESSION",
              categoryId: notes.id,
              rawText: request.text,
              amount: 1,
              occurredAt: rawEntry.occurredAt,
              occurredOn: rawEntry.occurredOn,
              data: {
                source: "memoato-memory",
                rawEntryId: rawEntry.id,
                rawText: request.text,
                note: request.text,
                tags: request.tags ?? [],
                apiKeyId,
                fallback: "notes",
              },
            },
            select: {
              id: true,
              categoryId: true,
              amount: true,
              duration: true,
            },
          });
          createdEvents.push(ev);
        }

        await tx.event.update({
          where: { id: rawEntry.id },
          data: {
            data: memoatoMemoryData({
              existing: rawEntry.data,
              request,
              apiKeyId,
              processingStatus: "complete",
              extraction,
              derivedEventIds: createdEvents.map((ev) => ev.id),
            }),
          },
        });
        await tx.memoryProcessingRun.update({
          where: { id: processingRun.id },
          data: {
            status: "complete",
            parserVersion: extraction.parserVersion,
            provider:
              extraction.provider ?? (aiExtraction ? "openrouter" : "local"),
            model: extraction.model ?? null,
            result: jsonValue({
              factCount: extraction.facts.length,
              derivedEventCount: createdEvents.length,
            }),
            finishedAt: new Date(),
          },
        });
        return createdEvents;
      },
    );

    return {
      rawEntryId: rawEntry.id,
      processingStatus: "complete",
      derivedEvents,
      extraction,
    };
  } catch (error) {
    await Promise.all([
      args.prisma.event.update({
        where: { id: rawEntry.id },
        data: {
          data: memoatoMemoryData({
            existing: rawEntry.data,
            request,
            apiKeyId,
            processingStatus: "failed",
            processingError: "processing_failed",
          }),
        },
      }),
      args.prisma.memoryProcessingRun.update({
        where: { id: processingRun.id },
        data: {
          status: "failed",
          errorCode: "processing_failed",
          finishedAt: new Date(),
        },
      }),
    ]);
    throw error;
  }
}

export function triggerRawMemoryProcessing(
  prisma: PrismaLike,
  rawEntryId: string,
): void {
  globalThis.setTimeout(() => {
    processRawMemoryEntry({ prisma, rawEntryId }).catch((error) => {
      console.error("Memoato raw entry processing failed", {
        rawEntryId,
        error,
      });
    });
  }, 0);
}

export async function createRawMemoryEntry(args: {
  prisma: PrismaLike;
  body: unknown;
  userId?: string;
  apiKeyId?: string | null;
}) {
  const request = parseCreateRawEntryRequest(args.body);
  const userId = args.userId ?? (await findIngestUser(args.prisma))?.id;
  if (!userId) throw new Error("ingest_user_not_configured");

  const occurredAt = parseOccurredAt(request.occurredAt);
  const occurredOn = occurredOnFromDate(occurredAt);

  const rawEntry = await args.prisma.$transaction(async (tx: PrismaLike) => {
    const created = await tx.event.create({
      data: {
        userId,
        source: request.source || API_SOURCE,
        kind: "NOTE",
        rawText: request.text,
        amount: 1,
        occurredAt,
        occurredOn,
        data: {
          memoatoMemory: {
            source: request.source || API_SOURCE,
            tags: request.tags ?? [],
            apiKeyId: args.apiKeyId ?? null,
            clientLabels: request.labels ?? [],
            processingStatus: "queued",
            derivedEventIds: [],
          },
        },
      },
      select: { id: true },
    });
    await tx.memoryProcessingRun.create({
      data: { userId, rawEntryId: created.id, attempt: 1, status: "queued" },
    });
    return created;
  });

  triggerRawMemoryProcessing(args.prisma, rawEntry.id);

  return {
    rawEntryId: rawEntry.id,
    processingStatus: "queued",
    derivedEvents: [],
    extraction: null,
  };
}

export async function queueMemoryReprocessing(args: {
  prisma: PrismaLike;
  rawEntryId: string;
  userId: string;
}): Promise<void> {
  const rawEntry = await args.prisma.event.findFirst({
    where: { id: args.rawEntryId, userId: args.userId, kind: "NOTE" },
    select: {
      id: true,
      userId: true,
      rawText: true,
      occurredAt: true,
      source: true,
      data: true,
    },
  });
  if (!rawEntry?.rawText) throw new Error("raw_entry_not_found");

  const latest = await args.prisma.memoryProcessingRun.findFirst({
    where: { rawEntryId: rawEntry.id },
    select: { attempt: true },
    orderBy: [{ attempt: "desc" }],
  });
  const request = requestFromRawEntry(rawEntry);
  await args.prisma.$transaction([
    args.prisma.memoryProcessingRun.create({
      data: {
        userId: args.userId,
        rawEntryId: rawEntry.id,
        attempt: (latest?.attempt ?? 0) + 1,
        status: "queued",
      },
    }),
    args.prisma.event.update({
      where: { id: rawEntry.id },
      data: {
        data: memoatoMemoryData({
          existing: rawEntry.data,
          request,
          apiKeyId: rawEntry?.data?.memoatoMemory?.apiKeyId ?? null,
          processingStatus: "queued",
        }),
      },
    }),
  ]);
  triggerRawMemoryProcessing(args.prisma, rawEntry.id);
}

export async function recoverPendingMemoryEntries(
  prisma: PrismaLike,
): Promise<number> {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const runs = await prisma.memoryProcessingRun.findMany({
    where: {
      OR: [
        { status: "queued" },
        {
          status: "processing",
          OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
        },
      ],
    },
    select: { id: true, rawEntryId: true, status: true },
    orderBy: [{ createdAt: "asc" }],
    take: 50,
  });

  for (const run of runs) {
    if (run.status === "processing") {
      await prisma.memoryProcessingRun.updateMany({
        where: { id: run.id, status: "processing" },
        data: { status: "queued", startedAt: null },
      });
    }
    triggerRawMemoryProcessing(prisma, run.rawEntryId);
  }
  return runs.length;
}

// Safe, idempotent compatibility backfill: it copies already-stored extraction
// JSON into the normalized read model. It never changes Event or Category rows.
export async function backfillLegacyMemoryFacts(
  prisma: PrismaLike,
  take = 500,
): Promise<number> {
  const entries = await prisma.event.findMany({
    where: {
      kind: "NOTE",
      userId: { not: null },
      rawMemoryFacts: { none: {} },
    },
    select: { id: true, userId: true, data: true },
    orderBy: [{ occurredAt: "desc" }],
    take: Math.max(1, Math.min(2_000, take)),
  });
  let created = 0;

  for (const entry of entries) {
    if (!entry.userId) continue;
    const extraction = entry?.data?.memoatoMemory?.extraction as
      | MemoryExtraction
      | undefined;
    if (
      !extraction ||
      !Array.isArray(extraction.facts) ||
      extraction.facts.length === 0
    )
      continue;
    const categoryIds = extraction.facts
      .map((fact) => fact.categoryId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const validCategories =
      categoryIds.length > 0
        ? new Set(
            (
              await prisma.category.findMany({
                where: { id: { in: categoryIds }, userId: entry.userId },
                select: { id: true },
              })
            ).map((item: any) => item.id),
          )
        : new Set<string>();

    const result = await prisma.memoryFact.createMany({
      data: extraction.facts.map((fact, position) => ({
        id: randomUUID(),
        userId: entry.userId,
        rawEntryId: entry.id,
        categoryId:
          fact.categoryId && validCategories.has(fact.categoryId)
            ? fact.categoryId
            : null,
        position,
        fingerprint: factFingerprint(fact, position),
        kind: fact.kind,
        label: fact.label,
        canonical: fact.canonical ?? null,
        amount:
          typeof fact.amount === "number" && Number.isFinite(fact.amount)
            ? fact.amount
            : null,
        unit: fact.unit ?? null,
        durationMinutes:
          typeof fact.durationMinutes === "number" &&
          Number.isFinite(fact.durationMinutes)
            ? fact.durationMinutes
            : null,
        confidence: Math.max(0, Math.min(1, fact.confidence)),
        origin: factOrigin(fact, extraction),
        status:
          fact.confidence >= MIN_AUTO_MATCH_CONFIDENCE
            ? "accepted"
            : "needs_review",
        data: jsonValue({ fact, legacyBackfill: true }),
        evidence: { source: "raw_entry" },
      })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}
