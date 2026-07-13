import { describe, expect, it } from "vitest";
import { normalizeGroundedRecallAnswer } from "./openRouterRecall";

describe("grounded Recall answers", () => {
  it("keeps only citations from the supplied evidence set", () => {
    const result = normalizeGroundedRecallAnswer(
      {
        answer: "Zadnji put je bilo u ponedjeljak.",
        citations: ["entry-2", "invented", "entry-2"],
        confidence: "high",
      },
      ["entry-1", "entry-2"],
      "model",
    );
    expect(result.citations).toEqual(["entry-2"]);
    expect(result.confidence).toBe("high");
  });

  it("defaults malformed confidence to low and rejects an empty answer", () => {
    expect(
      normalizeGroundedRecallAnswer(
        {
          answer: "Not enough evidence.",
          confidence: "certain",
          citations: ["entry-1"],
        },
        ["entry-1"],
      ).confidence,
    ).toBe("low");
    expect(() =>
      normalizeGroundedRecallAnswer({ answer: " " }, ["entry-1"]),
    ).toThrow("invalid_recall_answer");
  });
});
