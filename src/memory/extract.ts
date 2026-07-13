import type { MemoryExtraction, MemoryFact } from "./types";

const PARSER_VERSION = "memory-extract-v0";

function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function findDurationMinutes(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|minuta)/i.exec(
    text,
  );
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const hasFootballActivity =
    includesAny(lower, ["football", "nogomet"]) &&
    (durationMinutes != null ||
      includesAny(lower, ["cage", "played", "igra", "balun", "cardio"]));
  const hasCardioActivity = lower.includes("cardio") && durationMinutes != null;
  if (hasFootballActivity || hasCardioActivity) {
    facts.push({
      kind: "movement",
      label:
        lower.includes("cardio") &&
        !lower.includes("football") &&
        !lower.includes("nogomet")
          ? "cardio"
          : "football",
      canonical:
        lower.includes("cardio") &&
        !lower.includes("football") &&
        !lower.includes("nogomet")
          ? "Cardio"
          : "Football",
      categoryCandidates: ["Football", "Nogomet", "Cardio"],
      amount: durationMinutes ?? undefined,
      unit: durationMinutes ? "min" : undefined,
      durationMinutes: durationMinutes ?? undefined,
      confidence: durationMinutes ? 0.92 : 0.84,
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

  const calfAliases = [
    "listove",
    "listovi",
    "list",
    "calf raises",
    "calf raise",
  ];
  if (includesAny(lower, calfAliases)) {
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
  if (includesAny(lower, pushUpAliases)) {
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
