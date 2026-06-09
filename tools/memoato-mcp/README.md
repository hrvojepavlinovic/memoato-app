# Memoato MCP

Local MCP server for writing and reading raw life-log entries in Memoato.

Required environment:

```bash
MEMOATO_MCP_TOKEN="..."
```

Create `MEMOATO_MCP_TOKEN` in Memoato: Profile -> API keys -> Create key.
The app stores only a hash, so copy the token when it is shown.

Install:

```bash
curl -fsSL https://raw.githubusercontent.com/hrvojepavlinovic/memoato-app/main/tools/memoato-mcp/install.sh | bash
```

The token is a user API key. Memoato stores only its hash and derives the destination account from that key.

Codex:

```bash
codex mcp add memoato \
  --env MEMOATO_MCP_TOKEN=memoato_live_... \
  -- "$HOME/.memoato/bin/memoato-mcp"
```

Claude Desktop:

```json
{
  "mcpServers": {
    "memoato": {
      "command": "/Users/YOU/.memoato/bin/memoato-mcp",
      "env": {
        "MEMOATO_MCP_TOKEN": "memoato_live_..."
      }
    }
  }
}
```

Tools:

- `memoato_create_entry`: write a raw entry.
- `memoato_search_entries`: search raw entries, categories, tags, and parsed facts.
- `memoato_summarize_metric`: summarize a metric/activity over a date range.

Advanced: set `MEMOATO_API_ORIGIN` only if you run a self-hosted Memoato API.
