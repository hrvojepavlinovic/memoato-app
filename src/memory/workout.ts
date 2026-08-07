export type WorkoutMetricKey =
  | "duration_seconds"
  | "distance"
  | "active_kcal"
  | "total_kcal"
  | "heart_rate_avg"
  | "heart_rate_min"
  | "heart_rate_max"
  | "perceived_effort";

export type WorkoutDetailsInput = {
  durationSeconds?: number;
  distanceKm?: number;
  activeKcal?: number;
  totalKcal?: number;
  averageHeartRateBpm?: number;
  minHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  perceivedEffort?: { value: number; label?: string };
};

export type WorkoutMetricValue = {
  key: WorkoutMetricKey;
  value: number;
  unit: "seconds" | "km" | "kcal" | "bpm" | "score_10";
  role: "dimension" | "active_calorie_component" | "total_workout_energy";
  rollupTarget?: "daily_active_kcal";
  excludedFromDailyActiveKcal?: boolean;
  label?: string;
  dedupeKey?: string;
};

export type WorkoutDetails = {
  schemaVersion: 1;
  parentEventId: string;
  metrics: WorkoutMetricValue[];
  caloriePolicy: {
    dailyActiveComponentKey: "active_kcal";
    excludedKeys: ["total_kcal"];
    preventDoubleCount: true;
  };
};

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function bounded(value: unknown, min: number, max: number): number | undefined {
  const parsed = finitePositive(value);
  return parsed != null && parsed >= min && parsed <= max ? parsed : undefined;
}

export function parseWorkoutDetailsInput(
  input: unknown,
): WorkoutDetailsInput | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const raw = input as Record<string, unknown>;
  const effortRaw = raw.perceivedEffort;
  const effort =
    effortRaw && typeof effortRaw === "object" && !Array.isArray(effortRaw)
      ? {
          value: bounded((effortRaw as any).value, 1, 10),
          label:
            typeof (effortRaw as any).label === "string" &&
            (effortRaw as any).label.trim()
              ? (effortRaw as any).label.trim().slice(0, 40)
              : undefined,
        }
      : undefined;
  const parsed: WorkoutDetailsInput = {
    durationSeconds: finitePositive(raw.durationSeconds),
    distanceKm: finitePositive(raw.distanceKm),
    activeKcal: finitePositive(raw.activeKcal),
    totalKcal: finitePositive(raw.totalKcal),
    averageHeartRateBpm: bounded(raw.averageHeartRateBpm, 20, 260),
    minHeartRateBpm: bounded(raw.minHeartRateBpm, 20, 260),
    maxHeartRateBpm: bounded(raw.maxHeartRateBpm, 20, 260),
    perceivedEffort:
      effort?.value != null
        ? { value: effort.value, label: effort.label }
        : undefined,
  };
  return Object.values(parsed).some((value) => value != null)
    ? parsed
    : undefined;
}

export function buildWorkoutDetails(
  parentEventId: string,
  input: WorkoutDetailsInput,
): WorkoutDetails {
  const metrics: WorkoutMetricValue[] = [];
  const push = (metric: WorkoutMetricValue | null) => {
    if (metric) metrics.push(metric);
  };
  push(
    input.durationSeconds
      ? {
          key: "duration_seconds",
          value: input.durationSeconds,
          unit: "seconds",
          role: "dimension",
        }
      : null,
  );
  push(
    input.distanceKm
      ? {
          key: "distance",
          value: input.distanceKm,
          unit: "km",
          role: "dimension",
        }
      : null,
  );
  push(
    input.activeKcal
      ? {
          key: "active_kcal",
          value: input.activeKcal,
          unit: "kcal",
          role: "active_calorie_component",
          rollupTarget: "daily_active_kcal",
          dedupeKey: `workout:${parentEventId}:active_kcal`,
        }
      : null,
  );
  push(
    input.totalKcal
      ? {
          key: "total_kcal",
          value: input.totalKcal,
          unit: "kcal",
          role: "total_workout_energy",
          excludedFromDailyActiveKcal: true,
        }
      : null,
  );
  push(
    input.averageHeartRateBpm
      ? {
          key: "heart_rate_avg",
          value: input.averageHeartRateBpm,
          unit: "bpm",
          role: "dimension",
        }
      : null,
  );
  push(
    input.minHeartRateBpm
      ? {
          key: "heart_rate_min",
          value: input.minHeartRateBpm,
          unit: "bpm",
          role: "dimension",
        }
      : null,
  );
  push(
    input.maxHeartRateBpm
      ? {
          key: "heart_rate_max",
          value: input.maxHeartRateBpm,
          unit: "bpm",
          role: "dimension",
        }
      : null,
  );
  push(
    input.perceivedEffort
      ? {
          key: "perceived_effort",
          value: input.perceivedEffort.value,
          unit: "score_10",
          role: "dimension",
          label: input.perceivedEffort.label,
        }
      : null,
  );
  return {
    schemaVersion: 1,
    parentEventId,
    metrics,
    caloriePolicy: {
      dailyActiveComponentKey: "active_kcal",
      excludedKeys: ["total_kcal"],
      preventDoubleCount: true,
    },
  };
}

export function workoutMetricRows(userId: string, details: WorkoutDetails) {
  return details.metrics.map((metric) => ({
    userId,
    workoutEventId: details.parentEventId,
    key: metric.key,
    value: metric.value,
    unit: metric.unit,
    role: metric.role,
    rollupTarget: metric.rollupTarget ?? null,
    excludedFromDailyActiveKcal: metric.excludedFromDailyActiveKcal === true,
    label: metric.label ?? null,
    data: metric.dedupeKey ? { dedupeKey: metric.dedupeKey } : undefined,
  }));
}

export function workoutDetailsFromEventData(
  data: unknown,
): WorkoutDetails | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const workout = (data as any).workout;
  if (
    !workout ||
    workout.schemaVersion !== 1 ||
    !Array.isArray(workout.metrics)
  )
    return null;
  const metrics = workout.metrics.filter(
    (metric: any) =>
      metric &&
      typeof metric === "object" &&
      typeof metric.key === "string" &&
      typeof metric.value === "number" &&
      Number.isFinite(metric.value),
  ) as WorkoutMetricValue[];
  return { ...workout, metrics } as WorkoutDetails;
}

export function workoutMetricMap(
  details: WorkoutDetails | null,
): Map<WorkoutMetricKey, WorkoutMetricValue> {
  return new Map(
    (details?.metrics ?? []).map((metric) => [metric.key, metric]),
  );
}

export type ActiveKcalRollupEvent = {
  id: string;
  occurredOn: string;
  occurredAt: Date | string;
  manualDailyTotal?: number | null;
  legacyComponent?: number | null;
  data?: unknown;
};

// A manual daily total wins for that day. Otherwise components are summed once
// by their stable dedupe key. total_kcal is intentionally never considered.
export function activeKcalByDay(
  events: ActiveKcalRollupEvent[],
): Map<string, number> {
  const byDay = new Map<string, ActiveKcalRollupEvent[]>();
  for (const event of events)
    byDay.set(event.occurredOn, [
      ...(byDay.get(event.occurredOn) ?? []),
      event,
    ]);
  const result = new Map<string, number>();
  for (const [day, rows] of byDay) {
    const manual = rows
      .filter((row) => finitePositive(row.manualDailyTotal) != null)
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )[0];
    if (manual) {
      result.set(day, Number(manual.manualDailyTotal));
      continue;
    }
    const seen = new Set<string>();
    let total = 0;
    for (const row of rows) {
      const metric = workoutMetricMap(
        workoutDetailsFromEventData(row.data),
      ).get("active_kcal");
      const value =
        finitePositive(metric?.value) ?? finitePositive(row.legacyComponent);
      if (value == null) continue;
      const key = metric?.dedupeKey || `event:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total += value;
    }
    result.set(day, total);
  }
  return result;
}

export type WorkoutComparison = {
  key: WorkoutMetricKey;
  current: number;
  previous: number;
  delta: number;
  unit: string;
};

export function compareWorkoutDetails(
  current: WorkoutDetails | null,
  previous: WorkoutDetails | null,
): WorkoutComparison[] {
  const currentMap = workoutMetricMap(current);
  const previousMap = workoutMetricMap(previous);
  const out: WorkoutComparison[] = [];
  for (const [key, metric] of currentMap) {
    const prior = previousMap.get(key);
    if (!prior || prior.unit !== metric.unit) continue;
    out.push({
      key,
      current: metric.value,
      previous: prior.value,
      delta: metric.value - prior.value,
      unit: metric.unit,
    });
  }
  return out;
}
