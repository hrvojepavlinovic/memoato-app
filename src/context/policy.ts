import { createHash } from "node:crypto";

export const CONTEXT_POLICY_VERSION = "context-policy-v1";
export const CONNECTOR_CLAIM_POLICY_VERSION = "connector-claims-v1";
export const CONTEXT_SYNC_LIMIT = 50;
export const CONTEXT_PACKET_LIMIT = 20;

export function boundedContextPacketTake(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(CONTEXT_PACKET_LIMIT, Math.floor(parsed)))
    : CONTEXT_PACKET_LIMIT;
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function contextHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function normalizeContextQuery(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 240);
}

export function contextQueryTerms(value: unknown): string[] {
  return Array.from(
    new Set(
      normalizeContextQuery(value)
        .split(/\s+/)
        .filter((term) => term.length >= 2),
    ),
  ).slice(0, 12);
}
