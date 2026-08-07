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
          workoutId: "raw-1",
          exerciseKey: "pull_ups",
          repsPerSide: 3,
          sideMode: "per_side",
          weightKg: 5,
          tempo: "2-1-2",
          rir: 2,
          rpe: 7,
          feedback: "no pain",
          executionStatus: "performed",
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
        workoutId: "raw-1",
        exerciseKey: "pull_ups",
        repsPerSide: 3,
        sideMode: "per_side",
        weightKg: 5,
        tempo: "2-1-2",
        rir: 2,
        rpe: 7,
        feedback: "no pain",
        executionStatus: "performed",
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
