import type { MemoryExtraction, MemoryFact } from "./types";

const PARSER_VERSION = "memory-extract-v0";

function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function findDurationMinutes(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|minuta)/i.exec(text);
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
  const compact = /^\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kgs|kilogram|kilograms|kilograma)\s*$/i.exec(text);
  if (compact) return parsePositiveNumber(compact[1]);

  const hasWeightHint = includesAny(lower, ["weight", "body weight", "tezina", "težina", "kilaza", "kilaža", "vaga"]);
  if (!hasWeightHint) return null;

  const hinted = /(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kgs|kilogram|kilograms|kilograma)/i.exec(text);
  return parsePositiveNumber(hinted?.[1]);
}

function findSetsReps(text: string, aliases: string[]): { sets: number; reps: number } | null {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = new RegExp(`(\\d+)\\s*x\\s*(\\d+)\\s*(?:\\w+\\s+){0,2}${escaped}`, "i").exec(text);
    if (before) return { sets: Number(before[1]), reps: Number(before[2]) };

    const after = new RegExp(`${escaped}(?:\\s+\\w+){0,2}\\s+(\\d+)\\s*x\\s*(\\d+)`, "i").exec(text);
    if (after) return { sets: Number(after[1]), reps: Number(after[2]) };
  }
  return null;
}

export function extractDeterministicMemoryFacts(rawText: string): MemoryExtraction {
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
    });
  }

  if (includesAny(lower, ["sobna bicikla", "sobnu biciklu", "indoor bike", "stationary bike"])) {
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
    });
  }

  const calfAliases = ["listove", "listovi", "list", "calf raises", "calf raise"];
  if (includesAny(lower, calfAliases)) {
    const sr = findSetsReps(text, calfAliases);
    facts.push({
      kind: "movement",
      label: "calf raises",
      canonical: "Calf raises",
      categoryCandidates: ["Calf raises", "Calf raise", "Listovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      amount: sr ? sr.sets * sr.reps : undefined,
      unit: "reps",
      confidence: sr ? 0.97 : 0.84,
    });
  }

  const pullUpAliases = ["zgibove", "zgibovi", "zgiba", "zgib", "pull ups", "pull-ups", "pull up"];
  if (includesAny(lower, pullUpAliases)) {
    const sr = findSetsReps(text, pullUpAliases);
    facts.push({
      kind: "movement",
      label: "pull ups",
      canonical: "Pull ups",
      categoryCandidates: ["Pull ups", "Pull-ups", "Zgibovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      amount: sr ? sr.sets * sr.reps : undefined,
      unit: "reps",
      confidence: sr ? 0.98 : 0.86,
    });
  }

  const pushUpAliases = ["sklekove", "sklekovi", "sklek", "push ups", "push-ups", "push up"];
  if (includesAny(lower, pushUpAliases)) {
    const sr = findSetsReps(text, pushUpAliases);
    facts.push({
      kind: "movement",
      label: "push ups",
      canonical: "Push ups",
      categoryCandidates: ["Push ups", "Push-ups", "Sklekovi"],
      sets: sr?.sets,
      reps: sr?.reps,
      amount: sr ? sr.sets * sr.reps : undefined,
      unit: "reps",
      confidence: sr ? 0.97 : 0.84,
    });
  }

  if (includesAny(lower, ["low energy", "umoran", "umorna", "zgazen", "zgažen", "tired"])) {
    facts.push({
      kind: "energy",
      label: "low energy",
      canonical: "Low energy",
      confidence: 0.78,
    });
  }

  return {
    parser: "deterministic",
    parserVersion: PARSER_VERSION,
    facts,
    unknowns: facts.length === 0 ? [text] : [],
  };
}
