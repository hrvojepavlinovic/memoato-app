import { describe, expect, it } from "vitest";
import { extractDeterministicMemoryFacts } from "./extract";

describe("extractDeterministicMemoryFacts", () => {
  it("extracts compact body weight logs", () => {
    const result = extractDeterministicMemoryFacts("89.4kg");

    expect(result.facts).toEqual([
      expect.objectContaining({
        kind: "metric",
        canonical: "Weight",
        amount: 89.4,
        unit: "kg",
      }),
    ]);
    expect(result.unknowns).toEqual([]);
  });

  it("extracts imported strength and football raw logs", () => {
    const curls = extractDeterministicMemoryFacts(
      "dumbbell biceps curl 10 kg, 10 reps - outer right elbow tendon pain with palms up",
    );
    expect(curls.facts).toEqual([
      expect.objectContaining({
        canonical: "Biceps curls",
        amount: 10,
        unit: "reps",
        note: "10 kg",
      }),
    ]);

    const football = extractDeterministicMemoryFacts("cage football/cardio with my child ~60 min - played a lot with the ball");
    expect(football.facts).toEqual([
      expect.objectContaining({
        canonical: "Football",
        amount: 60,
        durationMinutes: 60,
        unit: "min",
      }),
    ]);
  });

  it("does not treat old football injury context as a football session", () => {
    const result = extractDeterministicMemoryFacts(
      "pull-up 2 reps - mild other-side right elbow pain, more like old football impact pain",
    );

    expect(result.facts).toEqual([
      expect.objectContaining({
        canonical: "Pull ups",
        amount: 2,
        unit: "reps",
      }),
    ]);
  });

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

  it("extracts pull-up set lists without losing individual set values", () => {
    const result = extractDeterministicMemoryFacts("Zgibovi 2 2 3");

    expect(result.facts).toEqual([
      expect.objectContaining({
        canonical: "Pull ups",
        setValues: [2, 2, 3],
        amount: 7,
        unit: "reps",
      }),
    ]);
  });
});
