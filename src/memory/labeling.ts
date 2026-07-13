import type { MemoryExtraction, MemoryFact, MemoryFactKind } from "./types";

type PrismaLike = any;

export type MemoryDomain =
  | "movement"
  | "health"
  | "family"
  | "work"
  | "finance"
  | "social"
  | "personal";

export type MemoryConceptDefinition = {
  key: string;
  displayName: string;
  domain: MemoryDomain;
  factKind: MemoryFactKind;
  description: string;
  defaultUnit?: string;
  aliases: string[];
  autoExtract?: boolean;
};

export const MEMORY_CONCEPT_CATALOG: MemoryConceptDefinition[] = [
  {
    key: "movement.football",
    displayName: "Football",
    domain: "movement",
    factKind: "movement",
    description: "Playing football or soccer, including balun and nogomet.",
    aliases: ["football", "soccer", "nogomet", "balun"],
    autoExtract: true,
  },
  {
    key: "movement.padel",
    displayName: "Padel",
    domain: "movement",
    factKind: "movement",
    description: "Playing or training padel.",
    aliases: ["padel"],
    autoExtract: true,
  },
  {
    key: "movement.walking",
    displayName: "Walking",
    domain: "movement",
    factKind: "movement",
    description: "Walking as movement, exercise or a fallback activity.",
    aliases: [
      "walking",
      "walked",
      "walk",
      "hodanje",
      "hodao",
      "hodala",
      "setnja",
      "setao",
    ],
    autoExtract: true,
  },
  {
    key: "movement.running",
    displayName: "Running",
    domain: "movement",
    factKind: "movement",
    description: "Running or jogging.",
    aliases: ["running", "ran", "run", "trcanje", "trcao", "trcala"],
    autoExtract: true,
  },
  {
    key: "movement.gym",
    displayName: "Gym",
    domain: "movement",
    factKind: "movement",
    description: "Gym training, including a completed or skipped session.",
    aliases: ["gym", "teretana", "trening u teretani"],
    autoExtract: true,
  },
  {
    key: "movement.indoor_bike",
    displayName: "Indoor bike",
    domain: "movement",
    factKind: "movement",
    description: "Stationary or indoor cycling.",
    defaultUnit: "min",
    aliases: [
      "indoor bike",
      "stationary bike",
      "sobna bicikla",
      "sobnu biciklu",
    ],
  },
  {
    key: "movement.pull_ups",
    displayName: "Pull ups",
    domain: "movement",
    factKind: "movement",
    description:
      "Pull ups or zgibovi, optionally represented as individual sets.",
    defaultUnit: "reps",
    aliases: ["pull ups", "pull up", "pullups", "zgibovi", "zgibove", "zgib"],
  },
  {
    key: "movement.push_ups",
    displayName: "Push ups",
    domain: "movement",
    factKind: "movement",
    description: "Push ups or sklekovi.",
    defaultUnit: "reps",
    aliases: [
      "push ups",
      "push up",
      "pushups",
      "sklekovi",
      "sklekove",
      "sklek",
    ],
  },
  {
    key: "movement.biceps_curls",
    displayName: "Biceps curls",
    domain: "movement",
    factKind: "movement",
    description: "Biceps curl exercise with reps, sets or weight context.",
    defaultUnit: "reps",
    aliases: ["biceps curls", "biceps curl", "curlsa", "curls"],
  },
  {
    key: "movement.calf_raises",
    displayName: "Calf raises",
    domain: "movement",
    factKind: "movement",
    description: "Calf raise exercise, including listovi.",
    defaultUnit: "reps",
    aliases: ["calf raises", "calf raise", "listovi", "listove"],
  },
  {
    key: "health.body_weight",
    displayName: "Body weight",
    domain: "health",
    factKind: "metric",
    description: "A body-weight measurement.",
    defaultUnit: "kg",
    aliases: ["body weight", "weight", "tezina", "kilaza", "vaga"],
  },
  {
    key: "health.energy",
    displayName: "Energy",
    domain: "health",
    factKind: "energy",
    description: "Personal energy level such as low, normal or high.",
    aliases: ["low energy", "energy", "energija", "umoran", "umorna", "tired"],
    autoExtract: true,
  },
  {
    key: "health.sleep",
    displayName: "Sleep quality",
    domain: "health",
    factKind: "context",
    description: "Sleep duration or quality and its surrounding context.",
    aliases: [
      "slept badly",
      "bad sleep",
      "sleep quality",
      "lose spavao",
      "lose spavala",
      "spavao lose",
      "spavala lose",
    ],
    autoExtract: true,
  },
  {
    key: "health.pain",
    displayName: "Pain",
    domain: "health",
    factKind: "context",
    description: "Pain or soreness, preserving body-part and trigger context.",
    aliases: [
      "pain",
      "hurt",
      "sore",
      "boli",
      "bolia",
      "bolio",
      "bolila",
      "bol",
    ],
    autoExtract: true,
  },
  {
    key: "health.temperature",
    displayName: "Temperature",
    domain: "health",
    factKind: "metric",
    description: "A measured body temperature or explicit fever note.",
    defaultUnit: "°C",
    aliases: ["temperature", "temperatura", "fever", "fibra"],
    autoExtract: true,
  },
  {
    key: "family.sleepover",
    displayName: "Sleepover",
    domain: "family",
    factKind: "context",
    description: "A family sleepover or staying overnight away from home.",
    aliases: [
      "sleepover",
      "prespavanac",
      "prespavancu",
      "prespavanje",
      "ostala spavati",
      "ostao spavati",
    ],
    autoExtract: true,
  },
  {
    key: "work.reflection",
    displayName: "Work reflection",
    domain: "work",
    factKind: "context",
    description:
      "A subjective note about work, a company, client or working conditions.",
    aliases: [
      "work reflection",
      "firma",
      "company",
      "posao",
      "client",
      "klijent",
    ],
    autoExtract: true,
  },
  {
    key: "work.client_call",
    displayName: "Client call",
    domain: "work",
    factKind: "context",
    description: "A client call or meeting and its effect on the day.",
    aliases: ["client call", "poziv s klijentom", "call s klijentom"],
    autoExtract: true,
  },
  {
    key: "finance.purchase",
    displayName: "Purchase",
    domain: "finance",
    factKind: "context",
    description: "A purchase with optional price, object and warranty context.",
    aliases: ["purchase", "bought", "kupio", "kupila", "kupia", "kupija"],
    autoExtract: true,
  },
  {
    key: "social.event",
    displayName: "Social event",
    domain: "social",
    factKind: "context",
    description: "Social time, gathering, visit, party or shared event.",
    aliases: ["social event", "druzenje", "druzili", "party", "zabava"],
    autoExtract: true,
  },
  {
    key: "personal.note",
    displayName: "Life note",
    domain: "personal",
    factKind: "note",
    description:
      "A meaningful personal note that does not yet map to a more specific concept.",
    aliases: ["life note", "personal note"],
  },
];

const CONCEPT_BY_KEY = new Map(
  MEMORY_CONCEPT_CATALOG.map((concept) => [concept.key, concept]),
);

export function normalizeMemoryPhrase(
  value: string | null | undefined,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value: string): string {
  return normalizeMemoryPhrase(value).replace(/\s+/g, "-");
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const normalized = normalizeMemoryPhrase(phrase);
  return normalized.length > 0 && ` ${haystack} `.includes(` ${normalized} `);
}

export function memoryConceptByKey(
  key: string | null | undefined,
): MemoryConceptDefinition | null {
  return key ? (CONCEPT_BY_KEY.get(key) ?? null) : null;
}

export function memoryConceptsForText(text: string): MemoryConceptDefinition[] {
  const normalized = normalizeMemoryPhrase(text);
  if (!normalized) return [];
  return MEMORY_CONCEPT_CATALOG.filter(
    (concept) =>
      concept.autoExtract &&
      concept.aliases.some((alias) => containsPhrase(normalized, alias)),
  );
}

function domainForKind(kind: MemoryFactKind): MemoryDomain {
  if (kind === "movement") return "movement";
  if (kind === "energy" || kind === "metric") return "health";
  return "personal";
}

function conceptForFact(fact: MemoryFact): MemoryConceptDefinition | null {
  const exact = memoryConceptByKey(fact.conceptKey);
  if (exact) return exact;
  const text = [
    fact.canonical,
    fact.label,
    fact.note,
    ...(fact.categoryCandidates ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const normalized = normalizeMemoryPhrase(text);
  if (!normalized) return null;
  return (
    MEMORY_CONCEPT_CATALOG.find((concept) =>
      concept.aliases.some((alias) => containsPhrase(normalized, alias)),
    ) ?? null
  );
}

export function normalizeMemoryFactLabel(fact: MemoryFact): MemoryFact {
  const concept = conceptForFact(fact);
  if (concept) {
    return {
      ...fact,
      domain: concept.domain,
      conceptKey: concept.key,
      canonical: concept.displayName,
    };
  }
  const displayName = String(
    fact.canonical || fact.label || "Life note",
  ).trim();
  const domain = fact.domain ?? domainForKind(fact.kind);
  return {
    ...fact,
    domain,
    conceptKey: fact.conceptKey || `${domain}.${slug(displayName) || "note"}`,
    canonical: displayName,
  };
}

export function extractCatalogMemoryFacts(rawText: string): MemoryExtraction {
  return {
    parser: "deterministic",
    parserVersion: "memory-concept-catalog-v1",
    facts: memoryConceptsForText(rawText).map((concept) => ({
      kind: concept.factKind,
      label: concept.displayName,
      canonical: concept.displayName,
      conceptKey: concept.key,
      domain: concept.domain,
      categoryCandidates:
        concept.factKind === "movement" || concept.factKind === "metric"
          ? [concept.displayName]
          : undefined,
      unit: concept.defaultUnit,
      confidence: 0.9,
      origin: "catalog",
    })),
    unknowns: [],
  };
}

export function ensureLabeledMemoryExtraction(
  rawText: string,
  extraction: MemoryExtraction,
): MemoryExtraction {
  const sourceFacts =
    extraction.facts.length > 0
      ? extraction.facts
      : extractCatalogMemoryFacts(rawText).facts;
  const normalized = (
    sourceFacts.length > 0
      ? sourceFacts
      : [
          {
            kind: "note" as const,
            label: "Life note",
            canonical: "Life note",
            conceptKey: "personal.note",
            domain: "personal" as const,
            confidence: 0.86,
            origin: "catalog" as const,
          },
        ]
  ).map(normalizeMemoryFactLabel);
  const seen = new Set<string>();
  const facts = normalized.filter((fact) => {
    const key = [
      fact.conceptKey,
      fact.amount ?? "",
      fact.unit ?? "",
      fact.setIndex ?? "",
      fact.setValues?.join(",") ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ...extraction,
    parserVersion: `${extraction.parserVersion}+memory-labels-v1`,
    facts,
    unknowns:
      facts[0]?.conceptKey === "personal.note"
        ? [rawText]
        : extraction.unknowns,
  };
}

export function primaryMemoryLabel(facts: Array<Partial<MemoryFact>>): {
  label: string;
  domain: string;
  conceptKey: string | null;
} {
  const primary = facts.find((fact) => fact.kind !== "note") ?? facts[0];
  return {
    label: String(primary?.canonical || primary?.label || "Life note"),
    domain: String(primary?.domain || "personal"),
    conceptKey: primary?.conceptKey ? String(primary.conceptKey) : null,
  };
}

export function conceptSearchText(args: {
  concept: any;
  aliases: any[];
}): string {
  return Array.from(
    new Set(
      [
        args.concept.key,
        args.concept.displayName,
        args.concept.domain,
        args.concept.factKind,
        args.concept.description,
        args.concept.defaultUnit,
        ...args.aliases.map((alias) => alias.phrase),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim()),
    ),
  ).join("\n");
}

export async function ensureMemoryConcept(args: {
  prisma: PrismaLike;
  userId: string;
  fact: MemoryFact;
  categoryId?: string | null;
}): Promise<any> {
  const fact = normalizeMemoryFactLabel(args.fact);
  const definition = memoryConceptByKey(fact.conceptKey);
  const key = fact.conceptKey || "personal.note";
  const concept = await args.prisma.memoryConcept.upsert({
    where: { userId_key: { userId: args.userId, key } },
    create: {
      userId: args.userId,
      categoryId: args.categoryId ?? null,
      key,
      displayName: fact.canonical || fact.label,
      domain: fact.domain || domainForKind(fact.kind),
      factKind: fact.kind,
      description: definition?.description ?? null,
      defaultUnit: definition?.defaultUnit ?? fact.unit ?? null,
      source: definition ? "catalog" : fact.origin || "parser",
    },
    update: {
      displayName: fact.canonical || fact.label,
      domain: fact.domain || domainForKind(fact.kind),
      factKind: fact.kind,
      ...(args.categoryId ? { categoryId: args.categoryId } : {}),
    },
  });
  const aliases = Array.from(
    new Set(
      [
        ...(definition?.aliases ?? []),
        fact.label,
        fact.canonical,
        ...(fact.categoryCandidates ?? []),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim()),
    ),
  );
  if (aliases.length > 0) {
    await args.prisma.memoryConceptAlias.createMany({
      data: aliases.map((phrase) => ({
        userId: args.userId,
        conceptId: concept.id,
        phrase,
        normalizedPhrase: slug(phrase),
        source: definition ? "catalog" : fact.origin || "parser",
      })),
      skipDuplicates: true,
    });
  }
  return concept;
}

export function recallAliasesFromConceptCatalog(): Record<string, string[]> {
  return Object.fromEntries(
    MEMORY_CONCEPT_CATALOG.filter(
      (concept) => concept.key !== "personal.note",
    ).map((concept) => {
      const canonical = concept.key.split(".").at(-1)!.replace(/_/g, "");
      const variants = Array.from(
        new Set(
          [concept.displayName, ...concept.aliases]
            .flatMap((value) => normalizeMemoryPhrase(value).split(/\s+/))
            .filter((value) => value.length >= 3),
        ),
      );
      return [canonical, [canonical, ...variants]];
    }),
  );
}
