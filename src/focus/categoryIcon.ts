export type CategoryIconInput = {
  emoji?: string | null;
  slug?: string | null;
  title?: string | null;
  unit?: string | null;
  kind?: string | null;
  categoryType?: string | null;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT_DEFAULTS: Record<string, string> = {
  football: "⚽",
  nogomet: "⚽",
  padel: "🎾",
  tennis: "🎾",
  weight: "⚖️",
  "body weight": "⚖️",
  tezina: "⚖️",
  notes: "📝",
  note: "📝",
  pain: "🩹",
  bol: "🩹",
  energy: "⚡",
  energija: "⚡",
  "body condition": "🧍",
  "workout session": "🏋️",
  "strength b workout": "🏋️",
  "dead bug": "🧘",
  "stationary cycling": "🚴",
  "indoor bike": "🚴",
  "sobna bicikla": "🚴",
  "wall sit": "🧱",
  "chair sit to stand": "🪑",
  "low step up": "🪜",
};

const PHRASE_DEFAULTS: Array<[phrases: string[], emoji: string]> = [
  [["active calories", "calories burned", "active kcal"], "🔥"],
  [["heart rate", "puls"], "❤️"],
  [["sleep", "san"], "😴"],
  [["anxiety", "anksioznost"], "🧠"],
  [["hydration", "water", "voda"], "💧"],
  [["temperature", "temperatura"], "🌡️"],
  [["cycling", "bike", "bicikl"], "🚴"],
  [["running", "trcanje"], "🏃"],
  [["walking", "hodanje"], "🚶"],
  [["pull up", "pullups", "zgib"], "💪"],
  [["push up", "pushups", "sklek"], "💪"],
  [
    [
      "dumbbell",
      "deadlift",
      "romanian deadlift",
      "shoulder press",
      "row",
      "veslanje",
      "calf raise",
      "glute bridge",
      "workout",
      "trening",
    ],
    "🏋️",
  ],
  [["dead bug", "core"], "🧘"],
];

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${phrase} `);
}

/**
 * Returns the category's manually selected icon, or a stable display fallback.
 * Fallbacks are intentionally derived instead of persisted so existing categories
 * gain an icon without a production data backfill.
 */
export function categoryIcon(
  category: CategoryIconInput | null | undefined,
): string {
  const custom = String(category?.emoji ?? "").trim();
  if (custom) return custom;

  const names = [normalize(category?.slug), normalize(category?.title)].filter(
    Boolean,
  );

  for (const name of names) {
    const exact = EXACT_DEFAULTS[name];
    if (exact) return exact;
  }

  for (const [phrases, emoji] of PHRASE_DEFAULTS) {
    if (
      names.some((name) =>
        phrases.some((phrase) => containsPhrase(name, phrase)),
      )
    ) {
      return emoji;
    }
  }

  const unit = normalize(category?.unit);
  if (unit === "kcal") return "🔥";
  if (unit === "bpm") return "❤️";
  if (unit === "kg" || unit === "kilograms") return "⚖️";
  if (unit === "minutes" || unit === "minute" || unit === "min") return "⏱️";
  if (unit === "reps" || unit === "rep") return "🏋️";
  if (unit === "score") return "📊";

  if (normalize(category?.kind) === "movement") return "🏃";

  const categoryType = normalize(category?.categoryType);
  if (categoryType === "do") return "✅";
  if (categoryType === "dont") return "🛑";
  if (categoryType === "goal") return "🎯";

  return "📌";
}
