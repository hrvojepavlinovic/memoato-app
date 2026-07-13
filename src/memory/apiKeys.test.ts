import { describe, expect, it } from "vitest";
import {
  CONTEXT_READ_SCOPE,
  MEMORY_READ_SCOPE,
  parseApiKeyScopes,
  RAW_ENTRY_WRITE_SCOPE,
  scopeAllowsMemoryRead,
  scopeAllowsContextRead,
  scopeAllowsRawEntryWrite,
  scopesForApiKeyAccess,
} from "./apiKeys";

describe("Memoato API key scopes", () => {
  it("parses comma and whitespace separated scopes without duplicates", () => {
    expect(
      parseApiKeyScopes("raw_entry:write, memory:read raw_entry:write"),
    ).toEqual([RAW_ENTRY_WRITE_SCOPE, MEMORY_READ_SCOPE]);
  });

  it("maps key access choices to least-privilege scopes", () => {
    expect(scopesForApiKeyAccess("logging")).toBe(RAW_ENTRY_WRITE_SCOPE);
    expect(scopesForApiKeyAccess("recall")).toBe(MEMORY_READ_SCOPE);
    expect(scopesForApiKeyAccess("context")).toBe(CONTEXT_READ_SCOPE);
    expect(scopesForApiKeyAccess("agent")).toBe(
      `${RAW_ENTRY_WRITE_SCOPE},${MEMORY_READ_SCOPE}`,
    );
  });

  it("does not treat a logging key as a recall key", () => {
    expect(scopeAllowsRawEntryWrite(RAW_ENTRY_WRITE_SCOPE)).toBe(true);
    expect(scopeAllowsMemoryRead(RAW_ENTRY_WRITE_SCOPE)).toBe(false);
    expect(scopeAllowsContextRead(MEMORY_READ_SCOPE)).toBe(false);
  });
});
