-- PostgreSQL remains Memoato's only source of truth and retrieval store.
-- This migration is additive: existing events and memory facts are untouched.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent itself is STABLE. This pinned dictionary wrapper is safe to use in
-- expression indexes and keeps Croatian diacritics searchable without special
-- client-side branches.
CREATE OR REPLACE FUNCTION public.memoato_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $function$
  SELECT public.unaccent('public.unaccent', input)
$function$;

CREATE TABLE "MemoryEmbedding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rawEntryId" TEXT NOT NULL,
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

  CONSTRAINT "MemoryEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryEmbedding_rawEntryId_model_version_key"
  ON "MemoryEmbedding"("rawEntryId", "model", "version");
CREATE INDEX "MemoryEmbedding_userId_status_idx"
  ON "MemoryEmbedding"("userId", "status");
CREATE INDEX "MemoryEmbedding_userId_model_version_idx"
  ON "MemoryEmbedding"("userId", "model", "version");
CREATE INDEX "MemoryEmbedding_rawEntryId_idx"
  ON "MemoryEmbedding"("rawEntryId");

CREATE INDEX "MemoryEmbedding_searchText_fts_idx"
  ON "MemoryEmbedding"
  USING GIN (to_tsvector('simple', public.memoato_unaccent("searchText")));

CREATE INDEX "MemoryEmbedding_searchText_trgm_idx"
  ON "MemoryEmbedding"
  USING GIN (public.memoato_unaccent(lower("searchText")) gin_trgm_ops);

ALTER TABLE "MemoryEmbedding"
  ADD CONSTRAINT "MemoryEmbedding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryEmbedding"
  ADD CONSTRAINT "MemoryEmbedding_rawEntryId_fkey"
  FOREIGN KEY ("rawEntryId") REFERENCES "Event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
