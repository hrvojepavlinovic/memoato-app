import { createHash, randomBytes } from "node:crypto";

export const RAW_ENTRY_WRITE_SCOPE = "raw_entry:write";
export const MEMORY_READ_SCOPE = "memory:read";
export const CONTEXT_READ_SCOPE = "context:read";

export type ApiKeyAccess = "agent" | "logging" | "recall" | "context";

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

export function parseApiKeyScopes(scope: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(scope ?? "")
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function scopeAllows(
  scope: string | string[] | null | undefined,
  requiredScope: string,
): boolean {
  const scopes = Array.isArray(scope) ? scope : parseApiKeyScopes(scope);
  return scopes.includes(requiredScope);
}

export function scopesForApiKeyAccess(access: ApiKeyAccess): string {
  if (access === "context") return CONTEXT_READ_SCOPE;
  if (access === "recall") return MEMORY_READ_SCOPE;
  if (access === "agent")
    return `${RAW_ENTRY_WRITE_SCOPE},${MEMORY_READ_SCOPE}`;
  return RAW_ENTRY_WRITE_SCOPE;
}

export function scopeAllowsRawEntryWrite(
  scope: string | string[] | null | undefined,
): boolean {
  return scopeAllows(scope, RAW_ENTRY_WRITE_SCOPE);
}

export function scopeAllowsMemoryRead(
  scope: string | string[] | null | undefined,
): boolean {
  return scopeAllows(scope, MEMORY_READ_SCOPE);
}

export function scopeAllowsContextRead(
  scope: string | string[] | null | undefined,
): boolean {
  return scopeAllows(scope, CONTEXT_READ_SCOPE);
}
