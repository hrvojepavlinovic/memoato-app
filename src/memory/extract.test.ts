import { describe, expect, it } from "vitest";
import { extractDeterministicMemoryFacts } from "./extract";

describe("extractDeterministicMemoryFacts", () => {
  it("extracts a compact training session from Croatian raw text", () => {
    const result = extractDeterministicMemoryFacts("Odradia sobnu biciklu 10 min, 2x10 listove i 2x2 zgibove");

    expect(result.facts).toEqual([
      expect.objectContaining({
        canonical: "Indoor bike",
        amount: 10,
        durationMinutes: 10,
        unit: "min",
      }),
      expect.objectContaining({
        canonical: "Calf raises",
        sets: 2,
        reps: 10,
        amount: 20,
        unit: "reps",
      }),
      expect.objectContaining({
        canonical: "Pull ups",
        sets: 2,
        reps: 2,
        amount: 4,
        unit: "reps",
      }),
    ]);
  });
});

