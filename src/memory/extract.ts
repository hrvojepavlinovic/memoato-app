import type { MemoryExtraction, MemoryFact } from "./types";
import { extractExerciseWorkoutFacts } from "./exercise";

const PARSER_VERSION = "memory-extract-v1-exercise-nesting";

function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function findDurationMinutes(text: string): number | null {
  const hoursMatch = /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|sat|sata)\b/i.exec(text);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1].replace(",", "."));
    const afterHours = text.slice((hoursMatch.index ?? 0) + hoursMatch[0].length);
    const minutesMatch = /^\s*(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|minuta)\b/i.exec(afterHours);
    const minutes = minutesMatch ? Number(minutesMatch[1].replace(",", ".")) : 0;
    const total = hours * 60 + minutes;
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  const minutesMatch = /(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|minuta)\b/i.exec(text);
  if (!minutesMatch) return null;
  const minutes = Number(minutesMatch[1].replace(",", "."));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function performedSportClause(text: string, aliases: string[]): string | null {
  const performed =
    /\b(?:played|igrao|igrala|igrali|igra\s+(?:sam|san)|odigrao|odigrala|odigrali|odigra\s+san|odradio|odradia|odradila|zavrsio|završio|zavrsila|završila)\b/i;
  for (const clause of text.split(/[.!?;]+/)) {
    const lower = clause.toLowerCase();
    if (!includesAny(lower, aliases)) continue;
    if (performed.test(clause)) return clause;
  }
  return null;
}

function parsePositiveNumber(input: string | undefined): number | null {
  if (!input) return null;
  const n = Number(input.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findBodyWeightKg(text: string, lower: string): number | null {
  const compact =
    /^\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kgs|kilogram|kilograms|kilograma)\s*$/i.exec(
      text,
    );
  if (compact) return parsePositiveNumber(compact[1]);

  const hasWeightHint = includesAny(lower, [
    "weight",
    "body weight",
    "tezina",
    "težina",
    "kilaza",
    "kilaža",
    "vaga",
  ]);
  if (!hasWeightHint) return null;

  const hinted =
    /(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kgs|kilogram|kilograms|kilograma)/i.exec(
      text,
    );
  return parsePositiveNumber(hinted?.[1]);
}

function findSetsReps(
  text: string,
  aliases: string[],
): { sets: number; reps: number } | null {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = new RegExp(
      `(\\d+)\\s*x\\s*(\\d+)\\s*(?:\\w+\\s+){0,2}${escaped}`,
      "i",
    ).exec(text);
    if (before) return { sets: Number(before[1]), reps: Number(before[2]) };

    const after = new RegExp(
      `${escaped}(?:\\s+\\w+){0,2}\\s+(\\d+)\\s*x\\s*(\\d+)`,
      "i",
    ).exec(text);
    if (after) return { sets: Number(after[1]), reps: Number(after[2]) };
  }
  return null;
}

function findListedReps(text: string, aliases: string[]): number[] | null {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const after = new RegExp(
      `${escaped}\\s+((?:\\d+\\s+){1,8}\\d+)(?!\\s*x)`,
      "i",
    ).exec(text);
    if (!after) continue;

    const values = after[1]
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0 && value < 500);
    if (values.length >= 2) return values;
  }
  return null;
}

function findSingleReps(text: string, aliases: string[]): number | null {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = new RegExp(
      `(\\d+)\\s*(?:reps?|x)?\\s*(?:\\w+\\s+){0,2}${escaped}`,
      "i",
    ).exec(text);
    if (before) return Number(before[1]);

    const after = new RegExp(
      `${escaped}[^\\d]{0,32}(\\d+)\\s*(?:reps?)?`,
      "i",
    ).exec(text);
    if (after) return Number(after[1]);
  }
  return null;
}

export function extractDeterministicMemoryFacts(
  rawText: string,
): MemoryExtraction {
  const text = cleanText(rawText);
  const lower = text.toLowerCase();
  const facts: MemoryFact[] = [];
  const exerciseFacts = extractExerciseWorkoutFacts(text);
  facts.push(...exerciseFacts);
  const exerciseKeys = new Set(
    exerciseFacts.map((fact) => fact.exerciseKey).filter(Boolean),
  );

  const bodyWeightKg = findBodyWeightKg(text, lower);
  if (bodyWeightKg != null) {
    facts.push({
      kind: "metric",
      label: "body weight",
      canonical: "Weight",
      categoryCandidates: ["Weight", "Tezina", "Težina", "Vaga"],
      amount: bodyWeightKg,
      unit: "kg",
      confidence: 0.98,
      origin: "deterministic",
    });
  }

  if (
    !exerciseKeys.has("stationary_cycling") &&
    includesAny(lower, [
      "sobna bicikla",
      "sobnu biciklu",
      "indoor bike",
      "stationary bike",
    ])
  ) {
    const durationMinutes = findDurationMinutes(text);
    facts.push({
      kind: "movement",
      label: "stationary bike",
      canonical: "Indoor bike",
      categoryCandidates: ["Indoor bike", "Stationary bike", "Bike"],
      amount: durationMinutes ?? undefined,
      unit: durationMinutes ? "min" : undefined,
      durationMinutes: durationMinutes ?? undefined,
      confidence: durationMinutes ? 0.98 : 0.86,
      origin: "deterministic",
    });
  }

  const durationMinutes = findDurationMinutes(text);
  const footballClause = performedSportClause(text, ["football", "nogomet", "balun"]);
  const footballDurationMinutes = footballClause ? findDurationMinutes(footballClause) : null;
  const hasFootballActivity = footballClause != null;
  const hasCardioActivity = lower.includes("cardio") && durationMinutes != null;
  if (hasFootballActivity || hasCardioActivity) {
    const isFootball = hasFootballActivity;
    const activityDuration = isFootball ? footballDurationMinutes : durationMinutes;
    facts.push({
      kind: "movement",
      label: isFootball ? "football" : "cardio",
      canonical: isFootball ? "Football" : "Cardio",
      categoryCandidates: ["Football", "Nogomet", "Cardio"],
      amount: isFootball ? 1 : (activityDuration ?? undefined),
      unit: isFootball ? undefined : activityDuration ? "min" : undefined,
      durationMinutes: activityDuration ?? undefined,
      executionStatus: isFootball ? "performed" : undefined,
      confidence: isFootball ? 0.96 : activityDuration ? 0.92 : 0.84,
      note: lower.includes("cage") ? "cage football/cardio context" : undefined,
      origin: "deterministic",
    });
  }

  const curlAliases = [
    "dumbbell biceps curl",
    "biceps curls",
    "biceps curl",
    "curlsa",
    "curls",
  ];
  if (includesAny(lower, curlAliases)) {
    const reps = findSingleReps(text, curlAliases);
    const kg = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilograma)/i.exec(text)?.[1];
    const weightKg = parsePositiveNumber(kg);
    facts.push({
      kind: "movement",
      label: "biceps curl",
      canonical: "Biceps curls",
      categoryCandidates: [
        "Biceps curls",
        "Biceps curl",
        "Dumbbell biceps curl",
      ],
      reps: reps ?? undefined,
      amount: reps ?? undefined,
      unit: reps ? "reps" : undefined,
      confidence: reps ? 0.94 : 0.84,
      note: weightKg ? `${weightKg} kg` : undefined,
      origin: "deterministic",
    });
  }

  const calfAliases = ["listove", "listovi", "calf raises", "calf raise"];
  if (
    !exerciseKeys.has("bilateral_calf_raise") &&
    includesAny(lower, calfAliases)
  ) {
    const sr = findSetsReps(text, calfAliases);
    const reps = sr ? sr.sets * sr.reps : findSingleReps(text, calfAliases);
    facts.push({
      kind: "movement",
      label: "calf raises",
      canonical: "Calf raises",
      categoryCandidates: ["Calf raises", "Calf raise", "Listovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      amount: reps ?? undefined,
      unit: reps ? "reps" : undefined,
      confidence: reps ? 0.97 : 0.84,
      origin: "deterministic",
    });
  }

  const pullUpAliases = [
    "zgibove",
    "zgibovi",
    "zgiba",
    "zgib",
    "pull ups",
    "pull-ups",
    "pull up",
    "pull-up",
  ];
  if (includesAny(lower, pullUpAliases)) {
    const sr = findSetsReps(text, pullUpAliases);
    const setValues = sr ? null : findListedReps(text, pullUpAliases);
    const reps = sr
      ? sr.sets * sr.reps
      : setValues
        ? setValues.reduce((sum, value) => sum + value, 0)
        : findSingleReps(text, pullUpAliases);
    facts.push({
      kind: "movement",
      label: "pull ups",
      canonical: "Pull ups",
      categoryCandidates: ["Pull ups", "Pull-ups", "Zgibovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      setValues: setValues ?? undefined,
      amount: reps ?? undefined,
      unit: reps ? "reps" : undefined,
      confidence: reps ? 0.98 : 0.86,
      origin: "deterministic",
    });
  }

  const pushUpAliases = [
    "sklekove",
    "sklekovi",
    "sklek",
    "push ups",
    "push-ups",
    "push up",
  ];
  if (!exerciseKeys.has("push_ups") && includesAny(lower, pushUpAliases)) {
    const sr = findSetsReps(text, pushUpAliases);
    const reps = sr ? sr.sets * sr.reps : findSingleReps(text, pushUpAliases);
    facts.push({
      kind: "movement",
      label: "push ups",
      canonical: "Push ups",
      categoryCandidates: ["Push ups", "Push-ups", "Sklekovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      amount: reps ?? undefined,
      unit: reps ? "reps" : undefined,
      confidence: reps ? 0.97 : 0.84,
      origin: "deterministic",
    });
  }

  if (
    includesAny(lower, [
      "low energy",
      "umoran",
      "umorna",
      "zgazen",
      "zgažen",
      "tired",
    ])
  ) {
    facts.push({
      kind: "energy",
      label: "low energy",
      canonical: "Low energy",
      confidence: 0.78,
      origin: "deterministic",
    });
  }

  return {
    parser: "deterministic",
    parserVersion: PARSER_VERSION,
    facts,
    unknowns: facts.length === 0 ? [text] : [],
  };
}
