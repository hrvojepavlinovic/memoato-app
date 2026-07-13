import { createHash } from "node:crypto";
import {
  EmbeddingError,
  embeddingConfigurationError,
  embedMemoryText,
  getEmbeddingConfig,
  isEmbeddingConfigured,
  toPgVector,
} from "./embedding";

type PrismaLike = any;

const MAX_ATTEMPTS = 4;
const STALE_PROCESSING_MS = 5 * 60_000;
let drainPromise: Promise<number> | null = null;

function errorCode(error: unknown): string {
  if (error instanceof EmbeddingError) return error.code.slice(0, 120);
  return "embedding_failed";
}

export function buildEmbeddingSearchText(entry: any): string {
  const facts = Array.isArray(entry?.rawMemoryFacts)
    ? entry.rawMemoryFacts
    : [];
  const lines = [String(entry?.rawText ?? "").trim()];
  for (const fact of facts) {
    if (fact?.status === "rejected") continue;
    const values = [
      fact?.label,
      fact?.canonical,
      typeof fact?.amount === "number" ? String(fact.amount) : null,
      fact?.unit,
      typeof fact?.durationMinutes === "number"
        ? `${fact.durationMinutes} min`
        : null,
      fact?.data?.fact?.note,
    ]
      .filter((value) => value != null && String(value).trim())
      .map((value) => String(value).trim());
    if (values.length > 0) lines.push(values.join(" · "));
  }
  return Array.from(new Set(lines.filter(Boolean)))
    .join("\n")
    .slice(0, 12_000);
}

export function embeddingContentHash(searchText: string): string {
  return createHash("sha256").update(searchText).digest("hex");
}

async function clearStoredVector(prisma: PrismaLike, id: string) {
  await prisma.$executeRawUnsafe(
    'UPDATE "MemoryEmbedding" SET "embedding" = NULL WHERE "id" = $1',
    id,
  );
}

export async function enqueueMemoryEmbedding(
  prisma: PrismaLike,
  rawEntryId: string,
): Promise<"queued" | "unchanged" | "missing" | "disabled"> {
  const config = getEmbeddingConfig();
  const entry = await prisma.event.findUnique({
    where: { id: rawEntryId },
    select: {
      id: true,
      userId: true,
      kind: true,
      rawText: true,
      rawMemoryFacts: {
        where: { status: { not: "rejected" } },
        select: {
          label: true,
          canonical: true,
          amount: true,
          unit: true,
          durationMinutes: true,
          status: true,
          data: true,
        },
        orderBy: [{ position: "asc" }],
      },
    },
  });
  if (
    !entry ||
    entry.kind !== "NOTE" ||
    !entry.userId ||
    !String(entry.rawText ?? "").trim()
  ) {
    return "missing";
  }

  const searchText = buildEmbeddingSearchText(entry);
  const contentHash = embeddingContentHash(searchText);
  const unique = {
    rawEntryId_model_version: {
      rawEntryId,
      model: config.model,
      version: config.version,
    },
  };
  const existing = await prisma.memoryEmbedding.findUnique({
    where: unique,
    select: { id: true, contentHash: true, status: true, attempt: true },
  });
  const configured = isEmbeddingConfigured();

  if (
    existing?.contentHash === contentHash &&
    (existing.status === "complete" ||
      existing.status === "processing" ||
      (existing.status === "queued" && configured) ||
      (existing.status === "disabled" && !configured) ||
      (existing.status === "failed" && existing.attempt >= MAX_ATTEMPTS))
  ) {
    return existing.status === "disabled" ? "disabled" : "unchanged";
  }

  const status = configured ? "queued" : "disabled";
  const configurationError = embeddingConfigurationError();
  const row = existing
    ? await prisma.memoryEmbedding.update({
        where: { id: existing.id },
        data: {
          dimensions: config.dimensions,
          searchText,
          contentHash,
          status,
          attempt: existing.contentHash === contentHash ? existing.attempt : 0,
          errorCode: configurationError,
          startedAt: null,
          finishedAt: configured ? null : new Date(),
        },
        select: { id: true },
      })
    : await prisma.memoryEmbedding.upsert({
        where: unique,
        create: {
          userId: entry.userId,
          rawEntryId,
          model: config.model,
          version: config.version,
          dimensions: config.dimensions,
          searchText,
          contentHash,
          status,
          errorCode: configurationError,
          finishedAt: configured ? null : new Date(),
        },
        update: {},
        select: { id: true, contentHash: true },
      });

  if (existing) await clearStoredVector(prisma, row.id);
  if (!existing && row.contentHash !== contentHash) {
    return enqueueMemoryEmbedding(prisma, rawEntryId);
  }
  return status;
}

async function claimNextEmbedding(prisma: PrismaLike): Promise<any | null> {
  const config = getEmbeddingConfig();
  const row = await prisma.memoryEmbedding.findFirst({
    where: {
      model: config.model,
      version: config.version,
      status: "queued",
      attempt: { lt: MAX_ATTEMPTS },
    },
    select: { id: true, searchText: true, attempt: true },
    orderBy: [{ createdAt: "asc" }],
  });
  if (!row) return null;
  const claimed = await prisma.memoryEmbedding.updateMany({
    where: { id: row.id, status: "queued", attempt: row.attempt },
    data: {
      status: "processing",
      attempt: { increment: 1 },
      startedAt: new Date(),
      finishedAt: null,
      errorCode: null,
    },
  });
  return claimed.count === 1 ? row : null;
}

async function processClaimedEmbedding(prisma: PrismaLike, row: any) {
  const config = getEmbeddingConfig();
  try {
    const vector = await embedMemoryText({
      text: row.searchText,
      inputType: "search_document",
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "MemoryEmbedding"
       SET "embedding" = $1::vector,
           "status" = 'complete',
           "errorCode" = NULL,
           "finishedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE "id" = $2 AND "status" = 'processing'`,
      toPgVector(vector, config.dimensions),
      row.id,
    );
  } catch (error) {
    await prisma.memoryEmbedding.updateMany({
      where: { id: row.id, status: "processing" },
      data: {
        status: "failed",
        errorCode: errorCode(error),
        finishedAt: new Date(),
      },
    });
  }
}

export function drainMemoryEmbeddingQueue(prisma: PrismaLike): Promise<number> {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    if (!isEmbeddingConfigured()) return 0;
    let processed = 0;
    while (true) {
      const row = await claimNextEmbedding(prisma);
      if (!row) break;
      await processClaimedEmbedding(prisma, row);
      processed += 1;
    }
    return processed;
  })().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

export function triggerMemoryEmbeddingProjection(
  prisma: PrismaLike,
  rawEntryId: string,
): void {
  globalThis.setTimeout(() => {
    enqueueMemoryEmbedding(prisma, rawEntryId)
      .then(() => drainMemoryEmbeddingQueue(prisma))
      .catch((error) => {
        console.error("Memoato search projection failed", {
          rawEntryId,
          error,
        });
      });
  }, 0);
}

export async function initializeMemoryEmbeddings(
  prisma: PrismaLike,
): Promise<{ projected: number; processed: number }> {
  const config = getEmbeddingConfig();
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  await prisma.memoryEmbedding.updateMany({
    where: {
      model: config.model,
      version: config.version,
      status: "processing",
      OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
    },
    data: { status: "queued", startedAt: null, errorCode: "stale_recovered" },
  });
  if (isEmbeddingConfigured()) {
    await prisma.memoryEmbedding.updateMany({
      where: {
        model: config.model,
        version: config.version,
        status: { in: ["disabled", "failed"] },
        attempt: { lt: MAX_ATTEMPTS },
      },
      data: { status: "queued", errorCode: null, finishedAt: null },
    });
  }

  let projected = 0;
  for (let batch = 0; batch < 20; batch += 1) {
    const entries = await prisma.event.findMany({
      where: {
        kind: "NOTE",
        userId: { not: null },
        rawText: { not: null },
        memoryEmbeddings: {
          none: { model: config.model, version: config.version },
        },
      },
      select: { id: true },
      orderBy: [{ occurredAt: "desc" }],
      take: 200,
    });
    if (entries.length === 0) break;
    for (const entry of entries) {
      await enqueueMemoryEmbedding(prisma, entry.id);
      projected += 1;
    }
  }
  const processed = await drainMemoryEmbeddingQueue(prisma);
  return { projected, processed };
}
