import type { MemoryExtraction, MemoryFact } from "./types";

export type ExerciseDefinition = {
  key: string;
  conceptKey: string;
  displayName: string;
  aliases: string[];
  categoryCandidates: string[];
  defaultUnit: "reps" | "sec" | "min";
};

export const EXERCISE_CATALOG: ExerciseDefinition[] = [
  {
    key: "dead_bug",
    conceptKey: "movement.dead_bug",
    displayName: "Dead Bug",
    aliases: ["dead bug", "dead bugs", "deadbug"],
    categoryCandidates: ["Dead Bug", "Dead bug"],
    defaultUnit: "reps",
  },
  {
    key: "push_ups",
    conceptKey: "movement.push_ups",
    displayName: "Push ups",
    aliases: [
      "push ups",
      "push-ups",
      "push up",
      "sklekovi",
      "sklekove",
      "sklek",
    ],
    categoryCandidates: ["Push ups", "Push-ups", "Sklekovi"],
    defaultUnit: "reps",
  },
  {
    key: "supported_one_arm_dumbbell_row",
    conceptKey: "movement.supported_one_arm_dumbbell_row",
    displayName: "Supported One-arm Dumbbell Row",
    aliases: [
      "supported one-arm dumbbell row",
      "supported one arm dumbbell row",
      "one-arm dumbbell row",
      "one arm dumbbell row",
      "dumbbell row",
      "veslanje bučicom",
      "veslanje bucicom",
      "row",
    ],
    categoryCandidates: [
      "Supported One-arm Dumbbell Row",
      "One-arm Dumbbell Row",
      "Dumbbell Row",
    ],
    defaultUnit: "reps",
  },
  {
    key: "chair_sit_to_stand",
    conceptKey: "movement.chair_sit_to_stand",
    displayName: "Chair Sit-to-stand",
    aliases: [
      "chair sit-to-stand",
      "chair sit to stand",
      "sit-to-stand",
      "sit to stand",
    ],
    categoryCandidates: ["Chair Sit-to-stand", "Sit-to-stand"],
    defaultUnit: "reps",
  },
  {
    key: "dumbbell_romanian_deadlift",
    conceptKey: "movement.dumbbell_romanian_deadlift",
    displayName: "Dumbbell Romanian Deadlift",
    aliases: [
      "dumbbell romanian deadlift",
      "romanian deadlift",
      "dumbbell rdl",
      "rdl",
    ],
    categoryCandidates: [
      "Dumbbell Romanian Deadlift",
      "Romanian Deadlift",
      "RDL",
    ],
    defaultUnit: "reps",
  },
  {
    key: "low_step_up",
    conceptKey: "movement.low_step_up",
    displayName: "Low Step-up",
    aliases: [
      "low step-up",
      "low step up",
      "niski step-up",
      "niski step up",
      "step-up",
      "step up",
    ],
    categoryCandidates: ["Low Step-up", "Step-up"],
    defaultUnit: "reps",
  },
  {
    key: "bilateral_calf_raise",
    conceptKey: "movement.bilateral_calf_raise",
    displayName: "Calf Raises",
    aliases: [
      "bilateral calf raise",
      "calf raises",
      "calf raise",
      "listovi",
      "listove",
    ],
    categoryCandidates: ["Calf Raises", "Calf raise", "Listovi"],
    defaultUnit: "reps",
  },
  {
    key: "wall_sit",
    conceptKey: "movement.wall_sit",
    displayName: "Wall Sit",
    aliases: ["wall sit", "wall sits", "zidni čučanj", "zidni cucanj"],
    categoryCandidates: ["Wall Sit", "Wall sit"],
    defaultUnit: "sec",
  },
  {
    key: "shallow_glute_bridge",
    conceptKey: "movement.glute_bridge",
    displayName: "Glute Bridge",
    aliases: ["shallow glute bridge", "plitki glute bridge", "glute bridge"],
    categoryCandidates: ["Glute Bridge", "Shallow Glute Bridge"],
    defaultUnit: "reps",
  },
  {
    key: "seated_dumbbell_shoulder_press",
    conceptKey: "movement.seated_dumbbell_shoulder_press",
    displayName: "Seated Dumbbell Shoulder Press",
    aliases: [
      "seated dumbbell shoulder press",
      "sjedeći dumbbell shoulder press",
      "sjedeci dumbbell shoulder press",
      "dumbbell shoulder press",
      "shoulder press",
    ],
    categoryCandidates: [
      "Seated Dumbbell Shoulder Press",
      "Dumbbell Shoulder Press",
    ],
    defaultUnit: "reps",
  },
  {
    key: "stationary_cycling",
    conceptKey: "movement.stationary_cycling",
    displayName: "Stationary Cycling",
    aliases: [
      "stationary cycling",
      "stationary bike",
      "indoor bike",
      "sobna bicikla",
      "sobnu biciklu",
    ],
    categoryCandidates: ["Stationary Cycling", "Stationary Bike"],
    defaultUnit: "min",
  },
];

const PERFORMED_MARKERS = [
  "completed",
  "performed",
  "finished",
  "dovrsen",
  "dovršen",
  "odradio",
  "odradia",
  "odradeno",
  "odrađeno",
  "napravio",
  "napravia",
];
const PLANNED_MARKERS = [
  "planned",
  "plan:",
  "plan za",
  "planirano",
  "prescribed",
  "propisano",
  "sutra",
  "tomorrow",
  "treba odraditi",
];
const REPORTED_MARKERS = [
  "reported",
  "reports",
  "says he",
  "said he",
  "kaže da",
  "kaze da",
  "rekao je",
  "zadnji trening",
  "last workout",
];

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\?\s+/g, "[\\s-]+");
}

function aliasRegex(alias: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(alias)}(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

function executionStatus(text: string): MemoryFact["executionStatus"] {
  const value = normalized(text);
  if (REPORTED_MARKERS.some((marker) => value.includes(normalized(marker))))
    return "reported";
  if (PLANNED_MARKERS.some((marker) => value.includes(normalized(marker))))
    return "planned";
  if (PERFORMED_MARKERS.some((marker) => value.includes(normalized(marker))))
    return "performed";
  return "performed";
}

function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const result = Number(value.replace(",", "."));
  return Number.isFinite(result) && result > 0 ? result : undefined;
}

function extractFeedback(segment: string): string | undefined {
  const patterns = [
    /\blagano\b/iu,
    /\beasy\b/iu,
    /\bbez boli\b/iu,
    /\bno pain\b/iu,
    /\bbez problema\b/iu,
    /\bwithout problems?\b/iu,
    /\bprelagano\b/iu,
    /\btoo easy\b/iu,
  ];
  const values = patterns
    .map((pattern) => pattern.exec(segment)?.[0]?.trim())
    .filter((value): value is string => !!value);
  return values.length > 0 ? Array.from(new Set(values)).join("; ") : undefined;
}

function extractSideMode(segment: string): MemoryFact["sideMode"] | undefined {
  if (/\b(po strani|svaka strana|per side|each side)\b|\/side/iu.test(segment))
    return "per_side";
  if (/\blijev(?:a|o|i)|\bleft\b/iu.test(segment)) return "left";
  if (/\bdesn(?:a|o|i)|\bright\b/iu.test(segment)) return "right";
  if (/\bbilateral(?:no)?\b/iu.test(segment)) return "bilateral";
  return undefined;
}

function exerciseFact(
  definition: ExerciseDefinition,
  segment: string,
  status: MemoryFact["executionStatus"],
): MemoryFact {
  const weightMatch = /(\d+(?:[.,]\d+)?)\s*kg\b/iu.exec(segment);
  const weightKg = positiveNumber(weightMatch?.[1]);
  const withoutWeight = segment.replace(/\d+(?:[.,]\d+)?\s*kg\b/giu, " ");
  const prescription = withoutWeight.split(/[;,]/, 1)[0] ?? withoutWeight;
  const setsReps = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)/iu.exec(prescription);
  let sets: number | undefined;
  let reps: number | undefined;
  let setValues: number[] | undefined;

  if (setsReps) {
    sets = positiveNumber(setsReps[1]);
    reps = positiveNumber(setsReps[2]);
    if (sets && reps && Number.isInteger(sets) && sets <= 30)
      setValues = Array.from({ length: sets }, () => reps!);
  } else {
    const values = Array.from(prescription.matchAll(/\b(\d+(?:[.,]\d+)?)\b/gu))
      .map((match) => positiveNumber(match[1]))
      .filter((value): value is number => value != null)
      .slice(0, 30);
    if (values.length > 0) {
      setValues = values;
      sets = values.length;
      if (values.every((value) => value === values[0])) reps = values[0];
    }
  }

  const sideMode = extractSideMode(segment);
  const tempo = /\b(\d+\s*[-–]\s*\d+\s*[-–]\s*\d+(?:\s*[-–]\s*\d+)?)\b/u
    .exec(segment)?.[1]
    ?.replace(/\s+/g, "");
  const rir = positiveNumber(
    /\brir\s*(\d+(?:[.,]\d+)?)\b/iu.exec(segment)?.[1] ??
      /\b(\d+(?:[.,]\d+)?)\s*(?:reps?|ponavljanja?)\s+(?:in reserve|u rezervi)\b/iu.exec(
        segment,
      )?.[1],
  );
  const rpe = positiveNumber(
    /\brpe\s*(\d+(?:[.,]\d+)?)\b/iu.exec(segment)?.[1],
  );
  const unit = definition.defaultUnit;
  const amount = setValues?.reduce((sum, value) => sum + value, 0);

  return {
    kind: "movement",
    label: definition.displayName,
    canonical: definition.displayName,
    conceptKey: definition.conceptKey,
    categoryCandidates: definition.categoryCandidates,
    exerciseKey: definition.key,
    executionStatus: status,
    sets,
    reps,
    setValues,
    repsPerSide: sideMode === "per_side" && reps != null ? reps : undefined,
    sideMode,
    weightKg,
    tempo,
    rir,
    rpe,
    feedback: extractFeedback(segment),
    amount,
    unit: amount != null ? unit : undefined,
    durationMinutes:
      unit === "min" && amount != null && setValues?.length === 1
        ? amount
        : undefined,
    confidence: 0.99,
    origin: "deterministic",
  };
}

export function extractExerciseWorkoutFacts(rawText: string): MemoryFact[] {
  const matches: Array<{
    definition: ExerciseDefinition;
    index: number;
  }> = [];
  for (const definition of EXERCISE_CATALOG) {
    let best: number | null = null;
    for (const alias of definition.aliases) {
      const match = aliasRegex(alias).exec(rawText);
      if (match && (best == null || match.index < best)) best = match.index;
    }
    if (best != null) matches.push({ definition, index: best });
  }
  matches.sort((a, b) => a.index - b.index);
  if (matches.length === 0) return [];

  const status = executionStatus(rawText);
  const exerciseFacts = matches.map((match, index) => {
    const prefix = rawText.slice(0, match.index);
    const separators = Array.from(prefix.matchAll(/[,;.—]|\s+(?:i|and)\s+/giu));
    const lastSeparator = separators.at(-1);
    const start = lastSeparator
      ? (lastSeparator.index ?? 0) + lastSeparator[0].length
      : 0;
    const end = matches[index + 1]?.index ?? rawText.length;
    return exerciseFact(match.definition, rawText.slice(start, end), status);
  });
  const program = /\bmini\s+strength\s+b\b/iu.test(rawText)
    ? "Mini Strength B"
    : /\bstrength\s+b\b/iu.test(rawText)
      ? "Strength B"
      : /\bupper\s*\/\s*core\s+a\b/iu.test(rawText)
        ? "Upper/Core A"
        : "Workout Session";
  const durationMinutes = positiveNumber(
    /(\d+(?:[.,]\d+)?)\s*(?:min|mins|minutes|minuta)\b/iu.exec(rawText)?.[1],
  );
  const rpe = positiveNumber(
    /\brpe\s*(\d+(?:[.,]\d+)?)\b/iu.exec(rawText)?.[1],
  );
  const workoutFact: MemoryFact = {
    kind: "movement",
    label: program,
    canonical: "Workout Session",
    conceptKey: "movement.workout_session",
    categoryCandidates: [
      "Workout Session",
      ...(program.includes("Strength B") ? ["Strength B Workout"] : []),
    ],
    executionStatus: status,
    durationMinutes,
    rpe,
    feedback: extractFeedback(rawText),
    confidence: 0.99,
    origin: "deterministic",
  };
  return [workoutFact, ...exerciseFacts];
}

export function linkWorkoutFactsToRawEntry(
  extraction: MemoryExtraction,
  rawEntryId: string,
): MemoryExtraction {
  if (
    !extraction.facts.some(
      (fact) =>
        fact.conceptKey === "movement.workout_session" || fact.exerciseKey,
    )
  )
    return extraction;
  return {
    ...extraction,
    facts: extraction.facts.map((fact) =>
      fact.conceptKey === "movement.workout_session" || fact.exerciseKey
        ? { ...fact, workoutId: fact.workoutId || rawEntryId }
        : fact,
    ),
  };
}

export function shouldProjectMemoryFact(fact: MemoryFact): boolean {
  return fact.executionStatus == null || fact.executionStatus === "performed";
}

export function factsForExerciseSetEvents(fact: MemoryFact): MemoryFact[] {
  if (!shouldProjectMemoryFact(fact)) return [];
  const setValues = Array.isArray(fact.setValues)
    ? fact.setValues.filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const expanded =
    setValues.length > 0
      ? setValues
      : fact.exerciseKey && fact.sets && fact.reps && fact.sets > 0
        ? Array.from(
            { length: Math.min(30, Math.floor(fact.sets)) },
            () => fact.reps!,
          )
        : [];
  if (expanded.length === 0) return [fact];
  return expanded.map((amount, index) => ({
    ...fact,
    amount,
    reps: fact.unit === "reps" ? amount : fact.reps,
    setIndex: index + 1,
    setCount: expanded.length,
    setValues: undefined,
  }));
}
