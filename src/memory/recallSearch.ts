import {
  embedMemoryText,
  getEmbeddingConfig,
  isEmbeddingConfigured,
  toPgVector,
} from "./embedding";
import type { ParsedRecallQuery } from "./recallTerms";

type PrismaLike = any;

export type RecallRank = {
  rawEntryId: string;
  score: number;
};

export type FusedRecallRank = {
  rawEntryId: string;
  score: number;
  lexicalScore: number | null;
  semanticScore: number | null;
  sources: Array<"lexical" | "semantic">;
};

function normalizedRanks(rows: any[]): RecallRank[] {
  return rows
    .map((row) => ({
      rawEntryId: String(row.rawEntryId ?? ""),
      score: Number(row.score ?? 0),
    }))
    .filter((row) => row.rawEntryId.length > 0 && Number.isFinite(row.score));
}

export function mergeRecallRanks(
  ...rankSets: Array<RecallRank[] | undefined>
): RecallRank[] {
  const merged = new Map<string, RecallRank>();
  for (const ranks of rankSets) {
    for (const rank of ranks ?? []) {
      const current = merged.get(rank.rawEntryId);
      if (!current || rank.score > current.score) {
        merged.set(rank.rawEntryId, rank);
      }
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => b.score - a.score || a.rawEntryId.localeCompare(b.rawEntryId),
  );
}

export function fuseRecallRanks(
  lexical: RecallRank[],
  semantic: RecallRank[],
  take: number,
): FusedRecallRank[] {
  const fused = new Map<string, FusedRecallRank>();
  const lexicalWeight = semantic.length > 0 ? 0.55 : 1;
  const semanticWeight = lexical.length > 0 ? 0.45 : 1;
  const add = (
    rows: RecallRank[],
    source: "lexical" | "semantic",
    weight: number,
  ) => {
    rows.forEach((row, index) => {
      const current = fused.get(row.rawEntryId) ?? {
        rawEntryId: row.rawEntryId,
        score: 0,
        lexicalScore: null,
        semanticScore: null,
        sources: [],
      };
      current.score += weight / (60 + index + 1);
      if (source === "lexical") current.lexicalScore = row.score;
      else current.semanticScore = row.score;
      if (!current.sources.includes(source)) current.sources.push(source);
      fused.set(row.rawEntryId, current);
    });
  };
  add(lexical, "lexical", lexicalWeight);
  add(semantic, "semantic", semanticWeight);
  return Array.from(fused.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.semanticScore ?? -Infinity) - (a.semanticScore ?? -Infinity),
    )
    .slice(0, Math.max(1, take));
}

async function lexicalCandidates(args: {
  prisma: PrismaLike;
  userId: string;
  parsed: ParsedRecallQuery;
  limit: number;
}): Promise<RecallRank[]> {
  const rows = await args.prisma.$queryRawUnsafe(
    `WITH recall_query AS (
       SELECT
         CASE WHEN $2::text = '' THEN NULL
              ELSE to_tsquery('simple', $2::text)
         END AS tsq,
         $3::text AS fuzzy
     ), latest_projection AS (
       SELECT DISTINCT ON ("rawEntryId")
         "rawEntryId",
         "searchText"
       FROM "MemoryEmbedding"
       WHERE "userId" = $1
       ORDER BY "rawEntryId", "updatedAt" DESC
     )
     SELECT
       me."rawEntryId",
       CASE WHEN q.tsq IS NULL THEN 0.1
            ELSE GREATEST(
              ts_rank_cd(
                to_tsvector('simple', public.memoato_unaccent(me."searchText")),
                q.tsq
              ),
              word_similarity(
                q.fuzzy,
                public.memoato_unaccent(lower(me."searchText"))
              )
            )
       END AS score
     FROM latest_projection me
     JOIN "Event" e ON e."id" = me."rawEntryId"
     CROSS JOIN recall_query q
     WHERE ($4::timestamptz IS NULL OR e."occurredAt" >= $4::timestamptz)
       AND ($5::timestamptz IS NULL OR e."occurredAt" < $5::timestamptz)
       AND (
         q.tsq IS NULL
         OR to_tsvector(
              'simple',
              public.memoato_unaccent(me."searchText")
            ) @@ q.tsq
         OR word_similarity(
              q.fuzzy,
              public.memoato_unaccent(lower(me."searchText"))
            ) >= 0.2
     )
     ORDER BY score DESC, e."occurredAt" DESC
     LIMIT $6`,
    args.userId,
    args.parsed.tsQuery ?? "",
    args.parsed.fuzzyText,
    args.parsed.range?.from ?? null,
    args.parsed.range?.to ?? null,
    args.limit,
  );
  return normalizedRanks(rows as any[]);
}

async function semanticCandidates(args: {
  prisma: PrismaLike;
  userId: string;
  parsed: ParsedRecallQuery;
  vector: number[];
  limit: number;
}): Promise<RecallRank[]> {
  const config = getEmbeddingConfig();
  const rows = await args.prisma.$queryRawUnsafe(
    `SELECT
       me."rawEntryId",
       1 - (me."embedding" <=> $4::vector) AS score
     FROM "MemoryEmbedding" me
     JOIN "Event" e ON e."id" = me."rawEntryId"
     WHERE me."userId" = $1
       AND me."model" = $2
       AND me."version" = $3
       AND me."status" = 'complete'
       AND me."embedding" IS NOT NULL
       AND ($5::timestamptz IS NULL OR e."occurredAt" >= $5::timestamptz)
       AND ($6::timestamptz IS NULL OR e."occurredAt" < $6::timestamptz)
     ORDER BY me."embedding" <=> $4::vector
     LIMIT $7`,
    args.userId,
    config.model,
    config.version,
    toPgVector(args.vector, config.dimensions),
    args.parsed.range?.from ?? null,
    args.parsed.range?.to ?? null,
    args.limit,
  );
  return normalizedRanks(rows as any[]);
}

async function semanticConceptCandidates(args: {
  prisma: PrismaLike;
  userId: string;
  parsed: ParsedRecallQuery;
  vector: number[];
  limit: number;
}): Promise<RecallRank[]> {
  const config = getEmbeddingConfig();
  const rows = await args.prisma.$queryRawUnsafe(
    `WITH nearest_concepts AS (
       SELECT
         mce."conceptId",
         1 - (mce."embedding" <=> $4::vector) AS concept_score
       FROM "MemoryConceptEmbedding" mce
       WHERE mce."userId" = $1
         AND mce."model" = $2
         AND mce."version" = $3
         AND mce."status" = 'complete'
         AND mce."embedding" IS NOT NULL
       ORDER BY mce."embedding" <=> $4::vector
       LIMIT 4
     )
     SELECT
       mec."rawEntryId",
       MAX(nc.concept_score) AS score
     FROM nearest_concepts nc
     JOIN "MemoryEntryConcept" mec ON mec."conceptId" = nc."conceptId"
     JOIN "Event" e ON e."id" = mec."rawEntryId"
     WHERE nc.concept_score >= 0.35
       AND ($5::timestamptz IS NULL OR e."occurredAt" >= $5::timestamptz)
       AND ($6::timestamptz IS NULL OR e."occurredAt" < $6::timestamptz)
     GROUP BY mec."rawEntryId"
     ORDER BY score DESC
     LIMIT $7`,
    args.userId,
    config.model,
    config.version,
    toPgVector(args.vector, config.dimensions),
    args.parsed.range?.from ?? null,
    args.parsed.range?.to ?? null,
    args.limit,
  );
  return normalizedRanks(rows as any[]);
}

export async function hybridRecallCandidates(args: {
  prisma: PrismaLike;
  userId: string;
  query: string;
  parsed: ParsedRecallQuery;
  take: number;
  includeSemantic?: boolean;
}): Promise<{
  ranks: FusedRecallRank[];
  mode: "hybrid" | "semantic" | "lexical";
  semanticAvailable: boolean;
}> {
  const candidateLimit = Math.max(40, Math.min(100, args.take * 3));
  const shouldEmbed =
    args.includeSemantic === true &&
    isEmbeddingConfigured() &&
    args.parsed.terms.length > 0;
  const [lexicalResult, embeddingResult] = await Promise.allSettled([
    lexicalCandidates({
      prisma: args.prisma,
      userId: args.userId,
      parsed: args.parsed,
      limit: candidateLimit,
    }),
    shouldEmbed
      ? embedMemoryText({
          text: args.query,
          inputType: "search_query",
        })
      : Promise.resolve(null),
  ]);

  const lexical =
    lexicalResult.status === "fulfilled" ? lexicalResult.value : [];
  let semantic: RecallRank[] = [];
  let semanticAvailable = false;
  if (embeddingResult.status === "fulfilled" && embeddingResult.value) {
    const [entryResult, conceptResult] = await Promise.allSettled([
      semanticCandidates({
        prisma: args.prisma,
        userId: args.userId,
        parsed: args.parsed,
        vector: embeddingResult.value,
        limit: candidateLimit,
      }),
      semanticConceptCandidates({
        prisma: args.prisma,
        userId: args.userId,
        parsed: args.parsed,
        vector: embeddingResult.value,
        limit: candidateLimit,
      }),
    ]);
    semantic = mergeRecallRanks(
      entryResult.status === "fulfilled" ? entryResult.value : [],
      conceptResult.status === "fulfilled" ? conceptResult.value : [],
    ).slice(0, candidateLimit);
    semanticAvailable =
      entryResult.status === "fulfilled" ||
      conceptResult.status === "fulfilled";
  }

  const mode =
    lexical.length > 0 && semantic.length > 0
      ? "hybrid"
      : semantic.length > 0
        ? "semantic"
        : "lexical";
  return {
    ranks: fuseRecallRanks(lexical, semantic, args.take),
    mode,
    semanticAvailable,
  };
}
