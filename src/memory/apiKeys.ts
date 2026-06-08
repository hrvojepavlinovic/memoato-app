import { createHash, randomBytes } from "node:crypto";

export const RAW_ENTRY_WRITE_SCOPE = "raw_entry:write";

export function generateApiKeyToken(): string {
  return `memoato_live_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKeyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getApiKeyPrefix(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 14)}…${trimmed.slice(-4)}`;
}

export function scopeAllowsRawEntryWrite(scope: string | null | undefined): boolean {
  return String(scope ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(RAW_ENTRY_WRITE_SCOPE);
}
