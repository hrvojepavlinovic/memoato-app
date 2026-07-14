import { recallAliasesFromConceptCatalog } from "./labeling";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "i",
  "me",
  "my",
  "did",
  "do",
  "was",
  "were",
  "what",
  "when",
  "where",
  "how",
  "last",
  "latest",
  "body",
  "low",
  "ups",
  "play",
  "played",
  "happen",
  "happened",
  "best",
  "je",
  "i",
  "sam",
  "mi",
  "moj",
  "moja",
  "moje",
  "sto",
  "sta",
  "kada",
  "kad",
  "gdje",
  "di",
  "koliko",
  "zadnji",
  "zadnja",
  "put",
  "igrao",
  "igrala",
  "odradio",
  "odradila",
  "radio",
  "radila",
  "imao",
  "imala",
]);

const ALIAS_GROUPS: Record<string, string[]> = {
  ...recallAliasesFromConceptCatalog(),
  weight: ["weight", "kila", "kilaza", "tezina", "vaga", "kg"],
  pull: ["pull", "pullup", "pullups", "zgib", "zgibovi", "zgibove", "zgibova"],
  push: [
    "push",
    "pushup",
    "pushups",
    "sklek",
    "sklekovi",
    "sklekove",
    "sklekova",
  ],
  football: ["football", "soccer", "nogomet", "balun"],
  run: ["run", "running", "ran", "trcanje", "trcao", "trcala", "trci"],
  pain: ["pain", "hurt", "sore", "bol", "boli", "bolio", "bolila"],
  sleep: ["sleep", "slept", "san", "spavanje", "spavao", "spavala"],
  energy: ["energy", "energija", "umor", "umoran", "umorna", "tired"],
  workout: [
    "workout",
    "workouts",
    "exercise",
    "exercises",
    "training",
    "trening",
    "vjezba",
    "vjezbanje",
  ],
};

const BROAD_DOMAIN_TERMS: Record<string, string> = {
  workout: "movement",
};

const TERM_ALIASES = Object.fromEntries(
  Object.entries(ALIAS_GROUPS).flatMap(([canonical, variants]) =>
    variants.map((variant) => [variant, canonical]),
  ),
) as Record<string, string>;

const DATE_WORDS = new Set([
  "today",
  "danas",
  "yesterday",
  "jucer",
  "yday",
  "this",
  "ovaj",
  "ova",
  "last",
  "prosli",
  "prosla",
  "week",
  "tjedan",
  "sedmica",
  "month",
  "mjesec",
  "days",
  "day",
  "dana",
  "zadnjih",
  "zadnja",
  "7",
  "30",
]);

export type RecallDateRange = {
  key:
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "last_7_days"
    | "last_30_days"
    | "this_month"
    | "last_month";
  label: string;
  from: Date;
  to: Date;
};

export type ParsedRecallQuery = {
  normalized: string;
  terms: string[];
  groups: string[][];
  tsQuery: string | null;
  fuzzyText: string;
  domainFilters: string[];
  range: RecallDateRange | null;
};

export function normalizeRecallText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function startOfDay(value: Date): Date {
  const out = new Date(value);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfIsoWeek(value: Date): Date {
  const out = startOfDay(value);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

function dateRange(normalized: string, now: Date): RecallDateRange | null {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  if (/\b(today|danas)\b/.test(normalized)) {
    return { key: "today", label: "Today / Danas", from: today, to: tomorrow };
  }
  if (/\b(yesterday|yday|jucer)\b/.test(normalized)) {
    return {
      key: "yesterday",
      label: "Yesterday / Jučer",
      from: addDays(today, -1),
      to: today,
    };
  }
  if (/\b(last 7 days|zadnjih 7 dana)\b/.test(normalized)) {
    return {
      key: "last_7_days",
      label: "Last 7 days / Zadnjih 7 dana",
      from: addDays(today, -6),
      to: tomorrow,
    };
  }
  if (/\b(last 30 days|zadnjih 30 dana)\b/.test(normalized)) {
    return {
      key: "last_30_days",
      label: "Last 30 days / Zadnjih 30 dana",
      from: addDays(today, -29),
      to: tomorrow,
    };
  }
  const thisWeek = startOfIsoWeek(today);
  if (/\b(this week|ovaj tjedan|ova sedmica)\b/.test(normalized)) {
    return {
      key: "this_week",
      label: "This week / Ovaj tjedan",
      from: thisWeek,
      to: tomorrow,
    };
  }
  if (/\b(last week|prosli tjedan|prosla sedmica)\b/.test(normalized)) {
    return {
      key: "last_week",
      label: "Last week / Prošli tjedan",
      from: addDays(thisWeek, -7),
      to: thisWeek,
    };
  }
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if (/\b(this month|ovaj mjesec)\b/.test(normalized)) {
    return {
      key: "this_month",
      label: "This month / Ovaj mjesec",
      from: thisMonth,
      to: tomorrow,
    };
  }
  if (/\b(last month|prosli mjesec)\b/.test(normalized)) {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      key: "last_month",
      label: "Last month / Prošli mjesec",
      from: lastMonth,
      to: thisMonth,
    };
  }
  return null;
}

export function searchMemoryTerms(query: string): string[] {
  return Array.from(
    new Set(
      normalizeRecallText(query)
        .split(/\s+/)
        .filter(
          (term) =>
            term.length >= 2 && !STOP_WORDS.has(term) && !DATE_WORDS.has(term),
        )
        .map((term) => TERM_ALIASES[term] ?? term),
    ),
  ).slice(0, 8);
}

export function buildPostgresTsQuery(groups: string[][]): string | null {
  const safeGroups = groups
    .map((group) =>
      Array.from(new Set(group))
        .map((term) => term.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter(Boolean)
        .slice(0, 12),
    )
    .filter((group) => group.length > 0);
  if (safeGroups.length === 0) return null;
  return safeGroups
    .map((group) => `(${group.map((term) => `${term}:*`).join(" | ")})`)
    .join(" & ");
}

export function parseRecallQuery(
  query: string,
  now = new Date(),
): ParsedRecallQuery {
  const normalized = normalizeRecallText(query);
  const terms = searchMemoryTerms(query);
  const groups = terms.map((term) => ALIAS_GROUPS[term] ?? [term]);
  const domainFilters = Array.from(
    new Set(terms.map((term) => BROAD_DOMAIN_TERMS[term]).filter(Boolean)),
  );
  const onlyBroadDomainTerms =
    terms.length > 0 && terms.every((term) => BROAD_DOMAIN_TERMS[term]);
  return {
    normalized,
    terms,
    groups,
    tsQuery: onlyBroadDomainTerms ? null : buildPostgresTsQuery(groups),
    fuzzyText: groups
      .flatMap((group) => group)
      .join(" ")
      .slice(0, 500),
    domainFilters,
    range: dateRange(normalized, now),
  };
}
