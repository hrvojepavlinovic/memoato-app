-- Stable concepts sit between raw evidence and user-facing category views.
-- This migration is additive and never rewrites or removes existing memory.

CREATE TABLE "MemoryConcept" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "factKind" TEXT NOT NULL,
  "description" TEXT,
  "defaultUnit" TEXT,
  "source" TEXT NOT NULL DEFAULT 'catalog',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryConcept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryConceptAlias" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "phrase" TEXT NOT NULL,
  "normalizedPhrase" TEXT NOT NULL,
  "language" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "source" TEXT NOT NULL DEFAULT 'catalog',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryConceptAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryEntryConcept" (
  "userId" TEXT NOT NULL,
  "rawEntryId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'secondary',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "origin" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryEntryConcept_pkey" PRIMARY KEY ("rawEntryId", "conceptId")
);

CREATE TABLE "MemoryConceptEmbedding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "searchText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "embedding" vector(1024),

  CONSTRAINT "MemoryConceptEmbedding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MemoryFact" ADD COLUMN "conceptId" TEXT;

CREATE UNIQUE INDEX "MemoryConcept_userId_key_key"
  ON "MemoryConcept"("userId", "key");
CREATE INDEX "MemoryConcept_userId_domain_idx"
  ON "MemoryConcept"("userId", "domain");
CREATE INDEX "MemoryConcept_categoryId_idx"
  ON "MemoryConcept"("categoryId");

CREATE UNIQUE INDEX "MemoryConceptAlias_userId_normalizedPhrase_key"
  ON "MemoryConceptAlias"("userId", "normalizedPhrase");
CREATE INDEX "MemoryConceptAlias_conceptId_idx"
  ON "MemoryConceptAlias"("conceptId");

CREATE INDEX "MemoryEntryConcept_userId_role_idx"
  ON "MemoryEntryConcept"("userId", "role");
CREATE INDEX "MemoryEntryConcept_conceptId_idx"
  ON "MemoryEntryConcept"("conceptId");

CREATE UNIQUE INDEX "MemoryConceptEmbedding_conceptId_model_version_key"
  ON "MemoryConceptEmbedding"("conceptId", "model", "version");
CREATE INDEX "MemoryConceptEmbedding_userId_model_version_idx"
  ON "MemoryConceptEmbedding"("userId", "model", "version");
CREATE INDEX "MemoryConceptEmbedding_userId_status_idx"
  ON "MemoryConceptEmbedding"("userId", "status");

CREATE INDEX "MemoryFact_conceptId_idx" ON "MemoryFact"("conceptId");

ALTER TABLE "MemoryConcept"
  ADD CONSTRAINT "MemoryConcept_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryConcept"
  ADD CONSTRAINT "MemoryConcept_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryConceptAlias"
  ADD CONSTRAINT "MemoryConceptAlias_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryConceptAlias"
  ADD CONSTRAINT "MemoryConceptAlias_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "MemoryConcept"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryEntryConcept"
  ADD CONSTRAINT "MemoryEntryConcept_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryEntryConcept"
  ADD CONSTRAINT "MemoryEntryConcept_rawEntryId_fkey"
  FOREIGN KEY ("rawEntryId") REFERENCES "Event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryEntryConcept"
  ADD CONSTRAINT "MemoryEntryConcept_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "MemoryConcept"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryConceptEmbedding"
  ADD CONSTRAINT "MemoryConceptEmbedding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryConceptEmbedding"
  ADD CONSTRAINT "MemoryConceptEmbedding_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "MemoryConcept"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryFact"
  ADD CONSTRAINT "MemoryFact_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "MemoryConcept"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
