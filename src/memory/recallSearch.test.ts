import { describe, expect, it, vi } from "vitest";
import { parseRecallQuery } from "./recallTerms";
import {
  fuseRecallRanks,
  hybridRecallCandidates,
  mergeRecallRanks,
} from "./recallSearch";

describe("hybrid Recall ranking", () => {
  it("rewards evidence found by both words and meaning", () => {
    const result = fuseRecallRanks(
      [
        { rawEntryId: "lexical-only", score: 0.9 },
        { rawEntryId: "both", score: 0.7 },
      ],
      [
        { rawEntryId: "both", score: 0.95 },
        { rawEntryId: "semantic-only", score: 0.8 },
      ],
      10,
    );
    expect(result[0].rawEntryId).toBe("both");
    expect(result[0].sources).toEqual(["lexical", "semantic"]);
    expect(result.map((row) => row.rawEntryId)).toHaveLength(3);
  });

  it("keeps deterministic rank order when semantic search is unavailable", () => {
    expect(
      fuseRecallRanks(
        [
          { rawEntryId: "one", score: 0.9 },
          { rawEntryId: "two", score: 0.8 },
        ],
        [],
        1,
      ),
    ).toEqual([
      expect.objectContaining({
        rawEntryId: "one",
        lexicalScore: 0.9,
        semanticScore: null,
      }),
    ]);
  });

  it("keeps the strongest semantic score when entry and concept recall overlap", () => {
    expect(
      mergeRecallRanks(
        [{ rawEntryId: "same-note", score: 0.61 }],
        [
          { rawEntryId: "same-note", score: 0.88 },
          { rawEntryId: "concept-note", score: 0.72 },
        ],
      ),
    ).toEqual([
      { rawEntryId: "same-note", score: 0.88 },
      { rawEntryId: "concept-note", score: 0.72 },
    ]);
  });

  it("returns lexical evidence without touching the embedding provider", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([{ rawEntryId: "football-note", score: 0.92 }]);
    const result = await hybridRecallCandidates({
      prisma: { $queryRawUnsafe: queryRaw },
      userId: "user-1",
      query: "Kad sam igrao nogomet?",
      parsed: parseRecallQuery("Kad sam igrao nogomet?"),
      take: 10,
      includeSemantic: false,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("lexical");
    expect(result.semanticAvailable).toBe(false);
    expect(result.ranks[0]).toEqual(
      expect.objectContaining({ rawEntryId: "football-note" }),
    );
  });

  it("pushes broad workout intent into the movement domain SQL guard", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    await hybridRecallCandidates({
      prisma: { $queryRawUnsafe: queryRaw },
      userId: "user-1",
      query: "best workout days",
      parsed: parseRecallQuery("best workout days"),
      take: 10,
      includeSemantic: false,
    });

    expect(queryRaw).toHaveBeenCalledWith(
      expect.stringContaining('mc."domain" = ANY($7::text[])'),
      "user-1",
      "",
      expect.any(String),
      null,
      null,
      expect.any(Number),
      ["movement"],
    );
  });
});
