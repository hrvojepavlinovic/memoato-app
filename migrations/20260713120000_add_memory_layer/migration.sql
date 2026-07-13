-- Memoato 2.0 is an additive interpretation layer. Existing User, Category,
-- Event and ApiKey rows are not rewritten or deleted by this migration.

CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawEntryId" TEXT NOT NULL,
    "derivedEventId" TEXT,
    "categoryId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "canonical" TEXT,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "durationMinutes" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "data" JSONB,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryProcessingRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawEntryId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "parserVersion" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "errorCode" TEXT,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryProcessingRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawEntryId" TEXT NOT NULL,
    "factId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "phrase" TEXT NOT NULL,
    "normalizedPhrase" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "kind" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'correction',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryFactEntity" (
    "factId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "MemoryFactEntity_pkey" PRIMARY KEY ("factId", "entityId")
);

CREATE TABLE "MemoryInference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "evidenceEntryIds" JSONB NOT NULL,
    "data" JSONB,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryInference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryFact_rawEntryId_fingerprint_key" ON "MemoryFact"("rawEntryId", "fingerprint");
CREATE INDEX "MemoryFact_userId_status_idx" ON "MemoryFact"("userId", "status");
CREATE INDEX "MemoryFact_userId_kind_idx" ON "MemoryFact"("userId", "kind");
CREATE INDEX "MemoryFact_userId_canonical_idx" ON "MemoryFact"("userId", "canonical");
CREATE INDEX "MemoryFact_rawEntryId_idx" ON "MemoryFact"("rawEntryId");
CREATE INDEX "MemoryFact_categoryId_idx" ON "MemoryFact"("categoryId");

CREATE UNIQUE INDEX "MemoryProcessingRun_rawEntryId_attempt_key" ON "MemoryProcessingRun"("rawEntryId", "attempt");
CREATE INDEX "MemoryProcessingRun_userId_status_idx" ON "MemoryProcessingRun"("userId", "status");
CREATE INDEX "MemoryProcessingRun_rawEntryId_createdAt_idx" ON "MemoryProcessingRun"("rawEntryId", "createdAt");

CREATE INDEX "MemoryCorrection_userId_createdAt_idx" ON "MemoryCorrection"("userId", "createdAt");
CREATE INDEX "MemoryCorrection_rawEntryId_idx" ON "MemoryCorrection"("rawEntryId");
CREATE INDEX "MemoryCorrection_factId_idx" ON "MemoryCorrection"("factId");

CREATE UNIQUE INDEX "MemoryAlias_userId_normalizedPhrase_key" ON "MemoryAlias"("userId", "normalizedPhrase");
CREATE INDEX "MemoryAlias_userId_canonical_idx" ON "MemoryAlias"("userId", "canonical");
CREATE INDEX "MemoryAlias_categoryId_idx" ON "MemoryAlias"("categoryId");

CREATE UNIQUE INDEX "MemoryEntity_userId_kind_normalizedName_key" ON "MemoryEntity"("userId", "kind", "normalizedName");
CREATE INDEX "MemoryEntity_userId_normalizedName_idx" ON "MemoryEntity"("userId", "normalizedName");
CREATE INDEX "MemoryFactEntity_entityId_idx" ON "MemoryFactEntity"("entityId");
CREATE INDEX "MemoryInference_userId_status_idx" ON "MemoryInference"("userId", "status");
CREATE INDEX "MemoryInference_userId_kind_idx" ON "MemoryInference"("userId", "kind");

ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_rawEntryId_fkey" FOREIGN KEY ("rawEntryId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_derivedEventId_fkey" FOREIGN KEY ("derivedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryProcessingRun" ADD CONSTRAINT "MemoryProcessingRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryProcessingRun" ADD CONSTRAINT "MemoryProcessingRun_rawEntryId_fkey" FOREIGN KEY ("rawEntryId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryCorrection" ADD CONSTRAINT "MemoryCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryCorrection" ADD CONSTRAINT "MemoryCorrection_rawEntryId_fkey" FOREIGN KEY ("rawEntryId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryCorrection" ADD CONSTRAINT "MemoryCorrection_factId_fkey" FOREIGN KEY ("factId") REFERENCES "MemoryFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryAlias" ADD CONSTRAINT "MemoryAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryAlias" ADD CONSTRAINT "MemoryAlias_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemoryEntity" ADD CONSTRAINT "MemoryEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryFactEntity" ADD CONSTRAINT "MemoryFactEntity_factId_fkey" FOREIGN KEY ("factId") REFERENCES "MemoryFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryFactEntity" ADD CONSTRAINT "MemoryFactEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MemoryEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryInference" ADD CONSTRAINT "MemoryInference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
