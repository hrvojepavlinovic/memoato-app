import { describe, expect, it } from "vitest";
import { normalizeOpenRouterExtraction } from "./openRouterExtractor";

describe("normalizeOpenRouterExtraction", () => {
  it("keeps explicit facts, clamps confidence, and labels their origin", () => {
    const result = normalizeOpenRouterExtraction({
      facts: [
        {
          kind: "metric",
          label: "body weight",
          amount: 89.85,
          unit: "kg",
          confidence: 2,
        },
        {
          kind: "movement",
          label: "pull ups",
          setValues: [2, -1, 3, "4"],
          confidence: 0.8,
        },
      ],
      unknowns: ["unclear time", 42],
    });

    expect(result.facts).toEqual([
      expect.objectContaining({
        label: "body weight",
        confidence: 1,
        origin: "openrouter",
      }),
      expect.objectContaining({
        label: "pull ups",
        setValues: [2, 3],
        confidence: 0.8,
        origin: "openrouter",
      }),
    ]);
    expect(result.unknowns).toEqual(["unclear time"]);
  });

  it("drops malformed facts instead of inventing a usable value", () => {
    const result = normalizeOpenRouterExtraction({
      facts: [{ kind: "metric", amount: 80 }, null, "weight"],
      unknowns: [],
    });

    expect(result.facts).toEqual([]);
  });
});
