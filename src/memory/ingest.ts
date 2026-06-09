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

function matchCategory(fact: MemoryFact, categories: CategoryLite[]): CategoryLite | null {
  if (fact.confidence < MIN_AUTO_MATCH_CONFIDENCE) return null;

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
  const categories = await listCategories(args.prisma, userId);

  const deterministic = extractDeterministicMemoryFacts(request.text);
  const aiExtraction =
    deterministic.facts.length === 0 && isOpenRouterExtractorConfigured()
      ? await extractWithOpenRouter({ rawText: request.text, categories })
      : null;
  const extraction = mergeExtractions(deterministic, aiExtraction);

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
          extraction,
        },
      },
    },
    select: { id: true },
  });

  const derivedEvents: Array<{ id: string; categoryId: string | null; amount: number | null; duration: number | null }> = [];
  for (const fact of extraction.facts) {
    if (fact.kind !== "movement" && fact.kind !== "metric") continue;
    const category = matchCategory(fact, categories);
    if (!category) continue;

    const amount = typeof fact.amount === "number" && Number.isFinite(fact.amount) ? fact.amount : 1;
    const ev = await args.prisma.event.create({
      data: {
        userId,
        source: request.source || API_SOURCE,
        kind: "SESSION",
        categoryId: category.id,
        rawText: request.text,
        amount,
        duration: fact.durationMinutes ? Math.round(fact.durationMinutes) : null,
        occurredAt,
        occurredOn,
        data: dataForDerivedEvent({ rawEntryId: rawEntry.id, fact, category, request, apiKeyId: args.apiKeyId ?? null }),
      },
      select: { id: true, categoryId: true, amount: true, duration: true },
    });
    derivedEvents.push(ev);
  }

  if (derivedEvents.length > 0) {
    await args.prisma.event.update({
      where: { id: rawEntry.id },
      data: {
        data: {
          memoatoMemory: {
            source: request.source || API_SOURCE,
            tags: request.tags ?? [],
            apiKeyId: args.apiKeyId ?? null,
            extraction,
            derivedEventIds: derivedEvents.map((ev) => ev.id),
          },
        },
      },
    });
  }

  return {
    rawEntryId: rawEntry.id,
    derivedEvents,
    extraction,
  };
}
