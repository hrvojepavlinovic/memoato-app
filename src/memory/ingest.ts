import type { CategoryLite, CreateRawEntryRequest, MemoryExtraction, MemoryFact } from "./types";
import { extractDeterministicMemoryFacts } from "./extract";
import { extractWithOpenRouter, isOpenRouterExtractorConfigured } from "./openRouterExtractor";
import { hashApiKeyToken, scopeAllowsRawEntryWrite } from "./apiKeys";

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
  return input.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean).slice(0, 20);
}

function parseNumber(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  return input;
}

function parseClientLabels(input: unknown): MemoryFact[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value) => value && typeof value === "object" && !Array.isArray(value))
    .map((value) => {
      const raw = value as Record<string, unknown>;
      const kindRaw = String(raw.kind ?? "").trim().toLowerCase();
      const kind: MemoryFact["kind"] =
        kindRaw === "movement" || kindRaw === "metric" || kindRaw === "energy" || kindRaw === "context" || kindRaw === "note"
          ? kindRaw
          : "note";
      const label = String(raw.label ?? raw.canonical ?? "").trim();
      if (!label) return null;
      const categoryCandidates = parseStringArray(raw.categoryCandidates);
      const setValues = Array.isArray(raw.setValues)
        ? raw.setValues.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0).slice(0, 30)
        : undefined;
      const confidence = parseNumber(raw.confidence);
      return {
        kind,
        label,
        categoryId: typeof raw.categoryId === "string" && raw.categoryId.trim() ? raw.categoryId.trim() : undefined,
        canonical: typeof raw.canonical === "string" && raw.canonical.trim() ? raw.canonical.trim() : undefined,
        categoryCandidates: categoryCandidates.length > 0 ? categoryCandidates : undefined,
        amount: parseNumber(raw.amount),
        unit: typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : undefined,
        durationMinutes: parseNumber(raw.durationMinutes),
        sets: parseNumber(raw.sets),
        reps: parseNumber(raw.reps),
        setValues,
        confidence: confidence == null ? 0.9 : Math.max(0, Math.min(1, confidence)),
        note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : undefined,
      } satisfies MemoryFact;
    })
    .filter((fact): fact is MemoryFact => !!fact)
    .slice(0, 30);
}

export function parseCreateRawEntryRequest(body: unknown): CreateRawEntryRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid_body");
  }
  const text = String((body as any).text ?? "").trim();
  if (text.length < 1) throw new Error("missing_text");
  if (text.length > 4000) throw new Error("text_too_long");
  return {
    text,
    occurredAt: typeof (body as any).occurredAt === "string" ? (body as any).occurredAt : undefined,
    source: typeof (body as any).source === "string" ? (body as any).source.trim().slice(0, 80) : undefined,
    tags: parseStringArray((body as any).tags),
    labels: parseClientLabels((body as any).labels),
  };
}

export function isAuthorizedRawEntryRequest(req: any): boolean {
  const configuredToken = env("MEMOATO_MCP_TOKEN");
  if (!configuredToken) return false;
  const header = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "").trim();
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === configuredToken;
}

function getBearerToken(req: any): string | null {
  const header = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "").trim();
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
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
    select: { id: true, userId: true, scope: true, expiresAt: true, revokedAt: true },
  });

  if (apiKey) {
    const now = new Date();
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= now.getTime()) return null;
    if (!scopeAllowsRawEntryWrite(apiKey.scope)) return null;

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: now } });
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
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (user) return user;
  }

  const email = env("MEMOATO_MCP_USER_EMAIL").toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) return user;
  }

  const username = env("MEMOATO_MCP_USERNAME");
  if (username) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (user) return user;
  }

  return null;
}

async function listCategories(prisma: PrismaLike, userId: string): Promise<CategoryLite[]> {
  return prisma.category.findMany({
    where: { userId, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true },
    orderBy: [{ title: "asc" }],
  });
}

async function ensureNotesCategory(prisma: PrismaLike, userId: string, categories: CategoryLite[]): Promise<CategoryLite> {
  const fromCache = categories.find((category) => normalizeKey(category.slug ?? category.title) === "notes");
  if (fromCache) return fromCache;

  const existing = await prisma.category.findFirst({
    where: { userId, slug: "notes", sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true, isSystem: true },
  });
  if (existing) {
    if (!existing.isSystem) {
      await prisma.category.update({ where: { id: existing.id }, data: { isSystem: true } });
    }
    return { id: existing.id, title: existing.title, slug: existing.slug, unit: existing.unit };
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

function mergeExtractions(primary: MemoryExtraction, fallback: MemoryExtraction | null): MemoryExtraction {
  if (!fallback || fallback.facts.length === 0) return primary;
  if (primary.facts.length === 0) return { ...fallback, parser: "hybrid" };

  const seen = new Set(primary.facts.map((fact) => normalizeKey(fact.canonical ?? fact.label)));
  const extraFacts = fallback.facts.filter((fact) => !seen.has(normalizeKey(fact.canonical ?? fact.label)));
  return {
    parser: "hybrid",
    parserVersion: `${primary.parserVersion}+${fallback.parserVersion}`,
    facts: [...primary.facts, ...extraFacts],
    unknowns: Array.from(new Set([...primary.unknowns, ...fallback.unknowns])),
  };
}

function isCategorizedFact(fact: MemoryFact): boolean {
  return fact.kind === "movement" || fact.kind === "metric";
}

function matchCategory(fact: MemoryFact, categories: CategoryLite[]): CategoryLite | null {
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

  for (const category of categories) {
    const keys = [category.title, category.slug].map(normalizeKey).filter(Boolean);
    if (keys.some((key) => wanted.includes(key))) return category;
  }

  return null;
}

function categoryTitleForFact(fact: MemoryFact): string {
  const raw = String(fact.canonical || fact.label || "Untitled").trim();
  if (!raw) return "Untitled";
  return raw
    .split(/\s+/)
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
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
): Promise<CategoryLite | null> {
  const matched = matchCategory(fact, categories);
  if (matched) return matched;

  if (!isCategorizedFact(fact) || fact.confidence < MIN_AUTO_MATCH_CONFIDENCE) return null;

  const title = categoryTitleForFact(fact);
  const slug = normalizeKey(title);
  if (!slug) return null;

  const existing = await prisma.category.findFirst({
    where: { userId, slug, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true, unit: true },
  });
  if (existing) {
    const category = { id: existing.id, title: existing.title, slug: existing.slug, unit: existing.unit };
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
  const previous = args.existing && typeof args.existing === "object" ? args.existing.memoatoMemory ?? {} : {};
  return {
    memoatoMemory: {
      ...previous,
      source: args.request.source || previous.source || API_SOURCE,
      tags: args.request.tags ?? previous.tags ?? [],
      apiKeyId: args.apiKeyId ?? previous.apiKeyId ?? null,
      processingStatus: args.processingStatus,
      ...(args.extraction ? { extraction: args.extraction } : {}),
      ...(args.derivedEventIds ? { derivedEventIds: args.derivedEventIds } : {}),
      ...(args.processingError ? { processingError: args.processingError } : { processingError: null }),
    },
  };
}

function requestFromRawEntry(rawEntry: any): CreateRawEntryRequest {
  const memory = rawEntry?.data?.memoatoMemory;
  return {
    text: String(rawEntry.rawText ?? ""),
    occurredAt: rawEntry.occurredAt instanceof Date ? rawEntry.occurredAt.toISOString() : undefined,
    source: typeof memory?.source === "string" ? memory.source : rawEntry.source,
    tags: Array.isArray(memory?.tags) ? memory.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
    labels: Array.isArray(memory?.clientLabels) ? memory.clientLabels : [],
  };
}

export async function processRawMemoryEntry(args: { prisma: PrismaLike; rawEntryId: string }) {
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

  if (!rawEntry || rawEntry.kind !== "NOTE" || !rawEntry.userId || !rawEntry.rawText) {
    throw new Error("raw_entry_not_found");
  }

  const request = requestFromRawEntry(rawEntry);
  const apiKeyId = rawEntry?.data?.memoatoMemory?.apiKeyId ?? null;

  try {
    await args.prisma.event.update({
      where: { id: rawEntry.id },
      data: { data: memoatoMemoryData({ existing: rawEntry.data, request, apiKeyId, processingStatus: "processing" }) },
    });

    await args.prisma.event.deleteMany({
      where: {
        userId: rawEntry.userId,
        kind: "SESSION",
        data: { path: ["rawEntryId"], equals: rawEntry.id },
      },
    });

    const categories = await listCategories(args.prisma, rawEntry.userId);
    const clientExtraction: MemoryExtraction | null =
      request.labels && request.labels.length > 0
        ? {
            parser: "client",
            parserVersion: "mcp-client-labels-v0",
            facts: request.labels,
            unknowns: [],
          }
        : null;
    const deterministic = extractDeterministicMemoryFacts(request.text);
    const baseExtraction = clientExtraction ? mergeExtractions(clientExtraction, deterministic) : deterministic;
    const aiExtraction = baseExtraction.facts.length === 0 && isOpenRouterExtractorConfigured()
      ? await extractWithOpenRouter({ rawText: request.text, categories })
      : null;
    const extraction = mergeExtractions(baseExtraction, aiExtraction);
    const derivedEvents: Array<{ id: string; categoryId: string | null; amount: number | null; duration: number | null }> = [];

    for (const fact of extraction.facts) {
      if (!isCategorizedFact(fact)) continue;

      const category = await findOrCreateCategoryForFact(args.prisma, rawEntry.userId, fact, categories);
      if (!category) continue;

      for (const eventFact of factsForDerivedEvents(fact)) {
        const amount = typeof eventFact.amount === "number" && Number.isFinite(eventFact.amount) ? eventFact.amount : 1;
        const ev = await args.prisma.event.create({
          data: {
            userId: rawEntry.userId,
            source: request.source || API_SOURCE,
            kind: "SESSION",
            categoryId: category.id,
            rawText: request.text,
            amount,
            duration: eventFact.durationMinutes ? Math.round(eventFact.durationMinutes) : null,
            occurredAt: eventFact.setIndex ? new Date(rawEntry.occurredAt.getTime() + (eventFact.setIndex - 1) * 1000) : rawEntry.occurredAt,
            occurredOn: rawEntry.occurredOn,
            data: dataForDerivedEvent({ rawEntryId: rawEntry.id, fact: eventFact, category, request, apiKeyId }),
          },
          select: { id: true, categoryId: true, amount: true, duration: true },
        });
        derivedEvents.push(ev);
      }
    }

    if (derivedEvents.length === 0) {
      const notes = await ensureNotesCategory(args.prisma, rawEntry.userId, categories);
      const ev = await args.prisma.event.create({
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
        select: { id: true, categoryId: true, amount: true, duration: true },
      });
      derivedEvents.push(ev);
    }

    await args.prisma.event.update({
      where: { id: rawEntry.id },
      data: {
        data: memoatoMemoryData({
          existing: rawEntry.data,
          request,
          apiKeyId,
          processingStatus: "complete",
          extraction,
          derivedEventIds: derivedEvents.map((ev) => ev.id),
        }),
      },
    });

    return {
      rawEntryId: rawEntry.id,
      processingStatus: "complete",
      derivedEvents,
      extraction,
    };
  } catch (error) {
    await args.prisma.event.update({
      where: { id: rawEntry.id },
      data: {
        data: memoatoMemoryData({
          existing: rawEntry.data,
          request,
          apiKeyId,
          processingStatus: "failed",
          processingError: error instanceof Error ? error.message : "processing_failed",
        }),
      },
    });
    throw error;
  }
}

function triggerRawMemoryProcessing(prisma: PrismaLike, rawEntryId: string): void {
  globalThis.setTimeout(() => {
    processRawMemoryEntry({ prisma, rawEntryId }).catch((error) => {
      console.error("Memoato raw entry processing failed", { rawEntryId, error });
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

  const rawEntry = await args.prisma.event.create({
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

  triggerRawMemoryProcessing(args.prisma, rawEntry.id);

  return {
    rawEntryId: rawEntry.id,
    processingStatus: "queued",
    derivedEvents: [],
    extraction: null,
  };
}
