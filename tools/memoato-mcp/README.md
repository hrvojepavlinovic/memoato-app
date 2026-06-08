# Memoato MCP

Local MCP server for writing raw life-log entries into Memoato.

Required environment:

```bash
MEMOATO_API_ORIGIN="https://api.memoato.com"
MEMOATO_MCP_TOKEN="..."
```

Run:

```bash
npm install
npm run build
MEMOATO_API_ORIGIN="https://api.memoato.com" MEMOATO_MCP_TOKEN="..." node dist/server.js
```

The token must match `MEMOATO_MCP_TOKEN` configured on the Memoato API server.

