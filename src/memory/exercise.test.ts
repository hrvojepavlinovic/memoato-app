import { describe, expect, it } from "vitest";
import { extractDeterministicMemoryFacts } from "./extract";
import {
  EXERCISE_CATALOG,
  factsForExerciseSetEvents,
  linkWorkoutFactsToRawEntry,
} from "./exercise";
import { parseCreateRawEntryRequest } from "./ingest";

function factByExerciseKey(text: string, exerciseKey: string) {
  return extractDeterministicMemoryFacts(text).facts.find(
    (fact) => fact.exerciseKey === exerciseKey,
  );
}

describe("nested exercise extraction", () => {
  it("covers the audited current exercise program with stable keys", () => {
    expect(EXERCISE_CATALOG.map((exercise) => exercise.key)).toEqual([
      "dead_bug",
      "push_ups",
      "supported_one_arm_dumbbell_row",
      "chair_sit_to_stand",
      "dumbbell_romanian_deadlift",
      "low_step_up",
      "bilateral_calf_raise",
      "wall_sit",
      "shallow_glute_bridge",
      "seated_dumbbell_shoulder_press",
      "stationary_cycling",
    ]);
  });

  it("extracts dead-bug set values and explicit feedback", () => {
    const result = extractDeterministicMemoryFacts(
      "dead bug 12 12, lagano, bez boli",
    );
    const workout = result.facts[0];
    const deadBug = factByExerciseKey(
      "dead bug 12 12, lagano, bez boli",
      "dead_bug",
    );

    expect(workout).toEqual(
      expect.objectContaining({
        conceptKey: "movement.workout_session",
        executionStatus: "performed",
      }),
    );
    expect(deadBug).toEqual(
      expect.objectContaining({
        canonical: "Dead Bug",
        setValues: [12, 12],
        sets: 2,
        reps: 12,
        feedback: "lagano; bez boli",
        executionStatus: "performed",
      }),
    );
  });

  it("extracts row load, per-side structure, and individual sets", () => {
    const row = factByExerciseKey(
      "row 10kg 10 10 svaka strana",
      "supported_one_arm_dumbbell_row",
    );

    expect(row).toEqual(
      expect.objectContaining({
        canonical: "Supported One-arm Dumbbell Row",
        weightKg: 10,
        setValues: [10, 10],
        repsPerSide: 10,
        sideMode: "per_side",
      }),
    );
    expect(factsForExerciseSetEvents(row!)).toEqual([
      expect.objectContaining({ amount: 10, setIndex: 1, setCount: 2 }),
      expect.objectContaining({ amount: 10, setIndex: 2, setCount: 2 }),
    ]);
  });

  it("preserves explicit tempo, RIR, and RPE", () => {
    const pushUps = factByExerciseKey(
      "push ups 2×8, tempo 2-1-2, RIR 3, RPE 6",
      "push_ups",
    );

    expect(pushUps).toEqual(
      expect.objectContaining({
        setValues: [8, 8],
        tempo: "2-1-2",
        rir: 3,
        rpe: 6,
      }),
    );
  });

  it("extracts the complete Mini Strength B workout and links every projection", () => {
    const raw =
      "Trening 2026-08-02: mini Strength B dovršen bez problema na svim gornjim granicama — wall sit 3×30 s, plitki glute bridge 2×15, sjedeći dumbbell shoulder press 2×10 i dead bug 2×8 po strani. Koljeno i stopalo tijekom treninga mirni.";
    const linked = linkWorkoutFactsToRawEntry(
      extractDeterministicMemoryFacts(raw),
      "raw-workout-1",
    );

    expect(linked.facts).toHaveLength(5);
    expect(linked.facts[0]).toEqual(
      expect.objectContaining({
        label: "Mini Strength B",
        conceptKey: "movement.workout_session",
        workoutId: "raw-workout-1",
        executionStatus: "performed",
      }),
    );
    expect(linked.facts.slice(1).map((fact) => fact.exerciseKey)).toEqual([
      "wall_sit",
      "shallow_glute_bridge",
      "seated_dumbbell_shoulder_press",
      "dead_bug",
    ]);
    expect(
      linked.facts
        .slice(1)
        .every(
          (fact) => fact.workoutId === "raw-workout-1",
        ),
    ).toBe(true);
    expect(
      linked.facts.slice(1).flatMap(factsForExerciseSetEvents),
    ).toHaveLength(9);
    expect(linked.facts.at(-1)).toEqual(
      expect.objectContaining({
        exerciseKey: "dead_bug",
        setValues: [8, 8],
        repsPerSide: 8,
        sideMode: "per_side",
      }),
    );
  });

  it("keeps planned and reported exercises queryable but out of completed projections", () => {
    const planned = extractDeterministicMemoryFacts(
      "Plan za sutra: dead bug 2×10 po strani",
    );
    const reported = extractDeterministicMemoryFacts(
      "Reported last workout: dead bug 2×12 per side",
    );

    expect(
      planned.facts.every((fact) => fact.executionStatus === "planned"),
    ).toBe(true);
    expect(
      reported.facts.every((fact) => fact.executionStatus === "reported"),
    ).toBe(true);
    expect(planned.facts.flatMap(factsForExerciseSetEvents)).toEqual([]);
    expect(reported.facts.flatMap(factsForExerciseSetEvents)).toEqual([]);
  });

  it("preserves nested fields supplied by an MCP/API client", () => {
    const request = parseCreateRawEntryRequest({
      text: "row 10kg 10 10 svaka strana",
      labels: [
        {
          kind: "movement",
          label: "row",
          workoutId: "client-workout",
          exerciseKey: "supported_one_arm_dumbbell_row",
          repsPerSide: 10,
          sideMode: "per_side",
          weightKg: 10,
          tempo: "2-1-2",
          rir: 3,
          rpe: 6,
          feedback: "bez boli",
          executionStatus: "performed",
          setValues: [10, 10],
        },
      ],
    });

    expect(request.labels?.[0]).toEqual(
      expect.objectContaining({
        workoutId: "client-workout",
        exerciseKey: "supported_one_arm_dumbbell_row",
        repsPerSide: 10,
        sideMode: "per_side",
        weightKg: 10,
        tempo: "2-1-2",
        rir: 3,
        rpe: 6,
        feedback: "bez boli",
        executionStatus: "performed",
      }),
    );
  });
});
