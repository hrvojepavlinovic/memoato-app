import { describe, expect, it } from "vitest";
import {
  activeKcalByDay,
  buildWorkoutDetails,
  compareWorkoutDetails,
  parseWorkoutDetailsInput,
  workoutMetricMap,
} from "./workout";

describe("typed workout metrics", () => {
  it("keeps one workout's active and total calories semantically separate", () => {
    const input = parseWorkoutDetailsInput({
      durationSeconds: 4022,
      distanceKm: 4.08,
      activeKcal: 876,
      totalKcal: 1016,
      averageHeartRateBpm: 162,
      minHeartRateBpm: 78,
      maxHeartRateBpm: 189,
      perceivedEffort: { value: 8, label: "Hard" },
    });
    expect(input).toBeDefined();
    const details = buildWorkoutDetails("football-event", input!);
    const metrics = workoutMetricMap(details);
    expect(details.metrics).toHaveLength(8);
    expect(new Set(details.metrics.map((metric) => metric.key)).size).toBe(8);
    expect(metrics.get("duration_seconds")?.value).toBe(4022);
    expect(metrics.get("active_kcal")).toMatchObject({
      value: 876,
      role: "active_calorie_component",
      rollupTarget: "daily_active_kcal",
      dedupeKey: "workout:football-event:active_kcal",
    });
    expect(metrics.get("total_kcal")).toMatchObject({
      value: 1016,
      role: "total_workout_energy",
      excludedFromDailyActiveKcal: true,
    });
  });

  it("uses one later manual daily total instead of summing workout components", () => {
    const workout = buildWorkoutDetails("football-event", {
      activeKcal: 876,
      totalKcal: 1016,
    });
    const rollup = activeKcalByDay([
      {
        id: "football-event",
        occurredOn: "2026-08-06",
        occurredAt: "2026-08-06T21:30:00+02:00",
        data: { workout },
      },
      {
        id: "daily-total",
        occurredOn: "2026-08-06",
        occurredAt: "2026-08-06T23:59:00+02:00",
        manualDailyTotal: 1234,
      },
    ]);
    expect(rollup.get("2026-08-06")).toBe(1234);
  });

  it("deduplicates active components and never adds total workout kcal", () => {
    const workout = buildWorkoutDetails("football-event", {
      activeKcal: 876,
      totalKcal: 1016,
    });
    const rollup = activeKcalByDay([
      {
        id: "a",
        occurredOn: "2026-08-06",
        occurredAt: "2026-08-06T21:30:00+02:00",
        data: { workout },
      },
      {
        id: "b",
        occurredOn: "2026-08-06",
        occurredAt: "2026-08-06T21:31:00+02:00",
        data: { workout },
      },
    ]);
    expect(rollup.get("2026-08-06")).toBe(876);
  });

  it("compares only compatible metrics with the previous matching workout", () => {
    const current = buildWorkoutDetails("current", {
      durationSeconds: 4022,
      distanceKm: 4.08,
      activeKcal: 876,
    });
    const previous = buildWorkoutDetails("previous", {
      durationSeconds: 3600,
      distanceKm: 3.8,
      activeKcal: 800,
    });
    expect(compareWorkoutDetails(current, previous)).toEqual([
      {
        key: "duration_seconds",
        current: 4022,
        previous: 3600,
        delta: 422,
        unit: "seconds",
      },
      {
        key: "distance",
        current: 4.08,
        previous: 3.8,
        delta: 0.28000000000000025,
        unit: "km",
      },
      {
        key: "active_kcal",
        current: 876,
        previous: 800,
        delta: 76,
        unit: "kcal",
      },
    ]);
  });
});
