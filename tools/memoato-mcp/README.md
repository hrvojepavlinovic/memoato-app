# Memoato MCP

Local MCP server for writing raw life-log entries into Memoato.

Required environment:

```bash
MEMOATO_API_ORIGIN="https://api.memoato.com"
MEMOATO_MCP_TOKEN="..."
```

Create `MEMOATO_MCP_TOKEN` in Memoato: Profile -> API keys -> Create key.
The app stores only a hash, so copy the token when it is shown.

Run:

```bash
npm install
npm run build
MEMOATO_API_ORIGIN="https://api.memoato.com" MEMOATO_MCP_TOKEN="..." node dist/server.js
```

The token is a user API key. Memoato stores only its hash and derives the destination account from that key.
