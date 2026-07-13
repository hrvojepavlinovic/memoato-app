import {
  CONTEXT_READ_SCOPE,
  MEMORY_READ_SCOPE,
  RAW_ENTRY_WRITE_SCOPE,
} from "./apiKeys";

export function requiredScopeForMcpTool(name: string): string | null {
  if (
    name === "memoato_logging_guide" ||
    name === "memoato_list_categories" ||
    name === "memoato_create_entry"
  ) {
    return RAW_ENTRY_WRITE_SCOPE;
  }
  if (
    name === "memoato_search_entries" ||
    name === "memoato_summarize_metric"
  ) {
    return MEMORY_READ_SCOPE;
  }
  if (name === "memoato_build_context_packet") return CONTEXT_READ_SCOPE;
  return null;
}

export function filterMcpToolsForScopes<T extends { name: string }>(
  tools: T[],
  scopes: string[],
): T[] {
  return tools.filter((tool) => {
    const requiredScope = requiredScopeForMcpTool(tool.name);
    return requiredScope ? scopes.includes(requiredScope) : false;
  });
}
