/** Shapes returned by the existing memory operations, shared by the reader UI. */
export type MemoryFactRecord = {
  id: string;
  label: string;
  canonical?: string | null;
  kind?: string;
  amount?: number | null;
  unit?: string | null;
  durationMinutes?: number | null;
  origin?: string;
  confidence?: number;
  status: string;
  data?: { fact?: { setValues?: number[] } } | null;
};
export type MemoryRecord = {
  id: string;
  rawText: string;
  source?: string;
  occurredAt: string | Date;
  processingStatus: string;
  facts?: MemoryFactRecord[];
};
export type MemoryFeed = {
  filter: string;
  entries: MemoryRecord[];
  nextBefore: string | Date | null;
};
export type MemoryOverview = {
  capturedToday: number;
  reviewCount: number;
  failedCount: number;
};
export type RecallResults = {
  query: string;
  entries: MemoryRecord[];
  count: number;
  mode?: string;
  range?: { label: string } | null;
  signal?: {
    label: string;
    latestValue: number;
    unit?: string | null;
    latestAt: string | Date;
  } | null;
};
export type RecallAnswer = {
  available: boolean;
  answer: string | null;
  citations: string[];
  confidence: string | null;
};
