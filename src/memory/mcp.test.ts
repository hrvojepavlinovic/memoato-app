import { describe, expect, it } from "vitest";
import { MEMORY_READ_SCOPE, RAW_ENTRY_WRITE_SCOPE } from "./apiKeys";
import { filterMcpToolsForScopes } from "./mcpCapabilities";

const tools = [
  "memoato_logging_guide",
  "memoato_list_categories",
  "memoato_create_entry",
  "memoato_search_entries",
  "memoato_summarize_metric",
].map((name) => ({ name }));

function toolNames(scopes: string[]) {
  return filterMcpToolsForScopes(tools, scopes).map((tool) => tool.name);
}

describe("Memoato MCP capabilities", () => {
  it("keeps logging-only keys out of recall tools", () => {
    expect(toolNames([RAW_ENTRY_WRITE_SCOPE])).toEqual([
      "memoato_logging_guide",
      "memoato_list_categories",
      "memoato_create_entry",
    ]);
  });

  it("keeps recall-only keys out of logging tools", () => {
    expect(toolNames([MEMORY_READ_SCOPE])).toEqual([
      "memoato_search_entries",
      "memoato_summarize_metric",
    ]);
  });
});
