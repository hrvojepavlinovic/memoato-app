export type MemoryFactKind = "movement" | "metric" | "energy" | "context" | "note";

export type MemoryFact = {
  kind: MemoryFactKind;
  label: string;
  categoryId?: string;
  canonical?: string;
  categoryCandidates?: string[];
  amount?: number;
  unit?: string;
  durationMinutes?: number;
  sets?: number;
  reps?: number;
  setValues?: number[];
  setIndex?: number;
  setCount?: number;
  confidence: number;
  note?: string;
};

export type MemoryExtraction = {
  parser: "deterministic" | "openrouter" | "client" | "hybrid";
  parserVersion: string;
  facts: MemoryFact[];
  unknowns: string[];
};

export type CreateRawEntryRequest = {
  text: string;
  occurredAt?: string;
  source?: string;
  tags?: string[];
  labels?: MemoryFact[];
};

export type CategoryLite = {
  id: string;
  title: string;
  slug: string | null;
  unit: string | null;
};
