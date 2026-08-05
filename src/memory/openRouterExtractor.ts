import type { CategoryLite, MemoryExtraction } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const FALLBACK_MODEL = "openai/gpt-4.1-mini";
const PARSER_VERSION = "openrouter-memory-extract-v1";
const REQUEST_TIMEOUT_MS = 12_000;

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function extractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["facts", "unknowns"],
    properties: {
      facts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "label", "confidence"],
          properties: {
            kind: {
              type: "string",
              enum: ["movement", "metric", "energy", "context", "note"],
            },
            label: { type: "string" },
            domain: {
              type: "string",
              enum: [
                "movement",
                "health",
                "family",
                "work",
                "finance",
                "social",
                "personal",
              ],
            },
            conceptKey: { type: "string" },
            canonical: { type: "string" },
            categoryCandidates: { type: "array", items: { type: "string" } },
            amount: { type: "number" },
            unit: { type: "string" },
            durationMinutes: { type: "number" },
            sets: { type: "number" },
            reps: { type: "number" },
            setValues: { type: "array", items: { type: "number" } },
            workoutId: { type: "string" },
            exerciseKey: { type: "string" },
            repsPerSide: { type: "number" },
            sideMode: {
              type: "string",
              enum: ["per_side", "left", "right", "bilateral", "alternating"],
            },
            weightKg: { type: "number" },
            tempo: { type: "string" },
            rir: { type: "number" },
            rpe: { type: "number" },
            feedback: { type: "string" },
            executionStatus: {
              type: "string",
              enum: ["performed", "planned", "reported"],
            },
            confidence: { type: "number" },
            note: { type: "string" },
          },
        },
      },
      unknowns: { type: "array", items: { type: "string" } },
    },
  };
}

export function normalizeOpenRouterExtraction(value: any): MemoryExtraction {
  const facts = Array.isArray(value?.facts) ? value.facts : [];
  const unknowns = Array.isArray(value?.unknowns)
    ? value.unknowns.filter((v: unknown) => typeof v === "string")
    : [];
  return {
    parser: "openrouter",
    parserVersion: PARSER_VERSION,
    facts: facts
      .filter(
        (fact: any) =>
          fact && typeof fact === "object" && typeof fact.label === "string",
      )
      .map((fact: any) => ({
        kind: ["movement", "metric", "energy", "context", "note"].includes(
          fact.kind,
        )
          ? fact.kind
          : "note",
        label: String(fact.label).trim(),
        domain: [
          "movement",
          "health",
          "family",
          "work",
          "finance",
          "social",
          "personal",
        ].includes(fact.domain)
          ? fact.domain
          : undefined,
        conceptKey:
          typeof fact.conceptKey === "string"
            ? fact.conceptKey.trim().toLowerCase()
            : undefined,
        canonical:
          typeof fact.canonical === "string"
            ? fact.canonical.trim()
            : undefined,
        categoryCandidates: Array.isArray(fact.categoryCandidates)
          ? fact.categoryCandidates
              .filter((v: unknown) => typeof v === "string")
              .map((v: string) => v.trim())
              .filter(Boolean)
          : undefined,
        amount:
          typeof fact.amount === "number" && Number.isFinite(fact.amount)
            ? fact.amount
            : undefined,
        unit: typeof fact.unit === "string" ? fact.unit.trim() : undefined,
        durationMinutes:
          typeof fact.durationMinutes === "number" &&
          Number.isFinite(fact.durationMinutes)
            ? fact.durationMinutes
            : undefined,
        sets:
          typeof fact.sets === "number" && Number.isFinite(fact.sets)
            ? fact.sets
            : undefined,
        reps:
          typeof fact.reps === "number" && Number.isFinite(fact.reps)
            ? fact.reps
            : undefined,
        setValues: Array.isArray(fact.setValues)
          ? fact.setValues.filter(
              (value: unknown) =>
                typeof value === "number" &&
                Number.isFinite(value) &&
                value > 0,
            )
          : undefined,
        workoutId:
          typeof fact.workoutId === "string" && fact.workoutId.trim()
            ? fact.workoutId.trim()
            : undefined,
        exerciseKey:
          typeof fact.exerciseKey === "string" && fact.exerciseKey.trim()
            ? fact.exerciseKey.trim()
            : undefined,
        repsPerSide:
          typeof fact.repsPerSide === "number" &&
          Number.isFinite(fact.repsPerSide)
            ? fact.repsPerSide
            : undefined,
        sideMode: [
          "per_side",
          "left",
          "right",
          "bilateral",
          "alternating",
        ].includes(fact.sideMode)
          ? fact.sideMode
          : undefined,
        weightKg:
          typeof fact.weightKg === "number" && Number.isFinite(fact.weightKg)
            ? fact.weightKg
            : undefined,
        tempo: typeof fact.tempo === "string" ? fact.tempo.trim() : undefined,
        rir:
          typeof fact.rir === "number" && Number.isFinite(fact.rir)
            ? fact.rir
            : undefined,
        rpe:
          typeof fact.rpe === "number" && Number.isFinite(fact.rpe)
            ? fact.rpe
            : undefined,
        feedback:
          typeof fact.feedback === "string" ? fact.feedback.trim() : undefined,
        executionStatus: ["performed", "planned", "reported"].includes(
          fact.executionStatus,
        )
          ? fact.executionStatus
          : undefined,
        confidence:
          typeof fact.confidence === "number" &&
          Number.isFinite(fact.confidence)
            ? Math.max(0, Math.min(1, fact.confidence))
            : 0.5,
        note: typeof fact.note === "string" ? fact.note.trim() : undefined,
        origin: "openrouter" as const,
      }))
      .filter((fact: any) => fact.label.length > 0),
    unknowns,
  };
}

export function isOpenRouterExtractorConfigured(): boolean {
  return !!env("OPENROUTER_API_KEY");
}

export async function extractWithOpenRouter(args: {
  rawText: string;
  categories: CategoryLite[];
}): Promise<MemoryExtraction | null> {
  const apiKey = env("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  const model = env("MEMOATO_AI_MODEL") || DEFAULT_MODEL;
  const fallbackModel = env("MEMOATO_AI_FALLBACK_MODEL") || FALLBACK_MODEL;
  const candidates = Array.from(
    new Set([model, fallbackModel].filter(Boolean)),
  );

  const categories = args.categories
    .map((c) => ({ title: c.title, slug: c.slug, unit: c.unit }))
    .slice(0, 120);

  for (const candidate of candidates) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            env("WASP_WEB_CLIENT_URL") || "https://app.memoato.com",
          "X-Title": "memoato",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: candidate,
          temperature: 0,
          max_tokens: 800,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "memoato_memory_extraction",
              strict: true,
              schema: extractionSchema(),
            },
          },
          messages: [
            {
              role: "system",
              content:
                "You are Memoato's conservative memory parser, not a coach or chatbot. Extract atomic personal memory facts from a raw life log. Preserve the human meaning and return only facts that are explicit in the text. Give each fact a broad domain and a stable lowercase conceptKey such as movement.football, health.sleep, family.sleepover or work.reflection. Prefer matching existing categories and their units. Use kind=metric for scalar measurements such as body weight or temperature. For a workout, emit one enclosing movement.workout_session fact and one fact per explicit exercise. For exercise set lists such as 'pull ups 2 2 3', use setValues. Preserve explicit side, weight, tempo, RIR, RPE, feedback and performed/planned/reported status. Never represent planned or merely reported work as performed. Context and feelings may be facts, but never diagnose, judge, recommend, or invent medical, money, relationship, identity or account details. Use confidence below 0.85 whenever wording or mapping is ambiguous.",
            },
            {
              role: "user",
              content: JSON.stringify({
                rawText: args.rawText,
                existingCategories: categories,
              }),
            },
          ],
        }),
      });

      if (!res.ok) continue;
      const payload = await res.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) continue;
      const extraction = normalizeOpenRouterExtraction(JSON.parse(content));
      return {
        ...extraction,
        provider: "openrouter",
        model: candidate,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      continue;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return null;
}
