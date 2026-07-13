import { createHash } from "node:crypto";
import {
  EmbeddingError,
  embeddingConfigurationError,
  embedMemoryText,
  getEmbeddingConfig,
  isEmbeddingConfigured,
  toPgVector,
} from "./embedding";
import { conceptSearchText } from "./labeling";

type PrismaLike = any;

const MAX_ATTEMPTS = 4;
let drainPromise: Promise<number> | null = null;

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorCode(error: unknown): string {
  if (error instanceof EmbeddingError) return error.code.slice(0, 120);
  return "concept_embedding_failed";
}

async function clearVector(prisma: PrismaLike, id: string) {
  await prisma.$executeRawUnsafe(
    'UPDATE "MemoryConceptEmbedding" SET "embedding" = NULL WHERE "id" = $1',
    id,
  );
}

async function enqueueConcepts(prisma: PrismaLike, userId?: string) {
  const config = getEmbeddingConfig();
  const configured = isEmbeddingConfigured();
  const concepts = await prisma.memoryConcept.findMany({
    where: { status: "active", ...(userId ? { userId } : {}) },
    include: {
      aliases: { select: { phrase: true }, orderBy: { phrase: "asc" } },
      embeddings: {
        where: { model: config.model, version: config.version },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 2_000,
  });
  let queued = 0;
  for (const concept of concepts) {
    const searchText = conceptSearchText({
      concept,
      aliases: concept.aliases,
    });
    const hash = contentHash(searchText);
    const existing = concept.embeddings[0];
    if (existing?.contentHash === hash) continue;
    const status = configured ? "queued" : "disabled";
    if (existing) {
      await prisma.memoryConceptEmbedding.update({
        where: { id: existing.id },
        data: {
          dimensions: config.dimensions,
          searchText,
          contentHash: hash,
          status,
          attempt: 0,
          errorCode: embeddingConfigurationError(),
          startedAt: null,
          finishedAt: configured ? null : new Date(),
        },
      });
      await clearVector(prisma, existing.id);
    } else {
      await prisma.memoryConceptEmbedding.create({
        data: {
          userId: concept.userId,
          conceptId: concept.id,
          model: config.model,
          version: config.version,
          dimensions: config.dimensions,
          searchText,
          contentHash: hash,
          status,
          errorCode: embeddingConfigurationError(),
          finishedAt: configured ? null : new Date(),
        },
      });
    }
    if (configured) queued += 1;
  }
  return queued;
}

async function claimNext(prisma: PrismaLike): Promise<any | null> {
  const config = getEmbeddingConfig();
  const row = await prisma.memoryConceptEmbedding.findFirst({
    where: {
      model: config.model,
      version: config.version,
      status: "queued",
      attempt: { lt: MAX_ATTEMPTS },
    },
    select: { id: true, searchText: true, attempt: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row) return null;
  const claimed = await prisma.memoryConceptEmbedding.updateMany({
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

async function processClaimed(prisma: PrismaLike, row: any) {
  const config = getEmbeddingConfig();
  try {
    const vector = await embedMemoryText({
      text: row.searchText,
      inputType: "search_document",
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "MemoryConceptEmbedding"
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
    await prisma.memoryConceptEmbedding.updateMany({
      where: { id: row.id, status: "processing" },
      data: {
        status: "failed",
        errorCode: errorCode(error),
        finishedAt: new Date(),
      },
    });
  }
}

export function initializeMemoryConceptEmbeddings(
  prisma: PrismaLike,
  userId?: string,
): Promise<number> {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    if (isEmbeddingConfigured()) {
      const config = getEmbeddingConfig();
      await prisma.memoryConceptEmbedding.updateMany({
        where: {
          model: config.model,
          version: config.version,
          status: { in: ["failed", "disabled"] },
          attempt: { lt: MAX_ATTEMPTS },
          ...(userId ? { userId } : {}),
        },
        data: { status: "queued", errorCode: null, finishedAt: null },
      });
    }
    await enqueueConcepts(prisma, userId);
    if (!isEmbeddingConfigured()) return 0;
    let processed = 0;
    while (true) {
      const row = await claimNext(prisma);
      if (!row) break;
      await processClaimed(prisma, row);
      processed += 1;
    }
    return processed;
  })().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

export function triggerMemoryConceptEmbeddingProjection(
  prisma: PrismaLike,
  userId: string,
) {
  globalThis.setTimeout(() => {
    initializeMemoryConceptEmbeddings(prisma, userId).catch((error) => {
      console.error("Memoato concept projection failed", { userId, error });
    });
  }, 0);
}
