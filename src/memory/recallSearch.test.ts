import { describe, expect, it } from "vitest";
import { fuseRecallRanks } from "./recallSearch";

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
});
