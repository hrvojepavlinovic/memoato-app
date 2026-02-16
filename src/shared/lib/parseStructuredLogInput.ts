import { parseNumberInput } from "./parseNumberInput";

export type ExtractedQuantity = {
  value: number;
  unit: "kg" | "ml" | "l" | "kcal" | "min" | "h" | "km" | null;
  source: string;
};

export type ParsedStructuredLogInput = {
  raw: string;
  hint: string;
  quantities: ExtractedQuantity[];
  hasExplicitUnit: boolean;
};

function normalizeUnit(rawUnit: string): ExtractedQuantity["unit"] {
  const u = rawUnit.trim().toLowerCase();
  if (!u) return null;

  if (u === "kg" || u === "kgs" || u === "kilogram" || u === "kilograms") return "kg";

  if (u === "ml" || u === "milliliter" || u === "milliliters" || u === "millilitre" || u === "millilitres") return "ml";
  if (u === "l" || u === "lt" || u === "liter" || u === "liters" || u === "litre" || u === "litres") return "l";

  if (u === "kcal" || u === "cal" || u === "cals" || u === "calorie" || u === "calories") return "kcal";

  if (u === "m" || u === "min" || u === "mins" || u === "minute" || u === "minutes") return "min";
  if (u === "h" || u === "hr" || u === "hrs" || u === "hour" || u === "hours") return "h";

  if (u === "km" || u === "kilometer" || u === "kilometers" || u === "kilometre" || u === "kilometres") return "km";

  return null;
}

function isTimeLikeToken(t: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(t.trim());
}

function isUnitToken(t: string): boolean {
  return normalizeUnit(t) != null;
}

export function parseStructuredLogInput(raw: string): ParsedStructuredLogInput {
  const s = raw.trim();
  if (!s) return { raw, hint: "", quantities: [], hasExplicitUnit: false };

  const parts = s.split(/\s+/g).filter(Boolean);
  const quantities: ExtractedQuantity[] = [];
  const remaining: string[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i];

    if (isTimeLikeToken(token)) {
      remaining.push(token);
      continue;
    }

    const mNumUnit = /^([+-]?\d+(?:[.,]\d+)?)([a-zA-Z]+)$/.exec(token);
    if (mNumUnit) {
      const value = parseNumberInput(mNumUnit[1]);
      const unit = normalizeUnit(mNumUnit[2]);
      if (value != null && unit != null) {
        quantities.push({ value, unit, source: token });
        continue;
      }
    }

    const value = parseNumberInput(token);
    if (value != null) {
      const next = parts[i + 1];
      if (next && isUnitToken(next)) {
        const unit = normalizeUnit(next);
        if (unit != null) {
          quantities.push({ value, unit, source: `${token} ${next}` });
          i += 1;
          continue;
        }
      }
      quantities.push({ value, unit: null, source: token });
      continue;
    }

    remaining.push(token);
  }

  return {
    raw,
    hint: remaining.join(" ").trim(),
    quantities,
    hasExplicitUnit: quantities.some((q) => q.unit != null),
  };
}

