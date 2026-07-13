# Dev setup

## Database (Postgres)

Memoato works with any Postgres instance. On some servers it’s convenient to use passwordless local connections over the
Postgres UNIX socket (peer auth).

Example socket setup:

- Socket dir: `/var/run/postgresql`
- Role: (your local Unix user, via peer auth)
- Database: `memoato`

Quick checks:

```bash
psql -d memoato -c 'select current_user, current_database();'
```

Wasp/Prisma uses `DATABASE_URL`:

```bash
cp .env.server.example .env.server
```

## Wasp workflow

```bash
# 1) Apply schema migrations
wasp db migrate-dev

# 2) Start dev server (client + server)
wasp start
```

## Google auth (optional)

If you want "Continue with Google" on login and signup, set:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.server`

In Google Cloud Console, configure:

- Authorized JavaScript origins:
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `http://localhost:3001/auth/google/callback`

For production, use your `WASP_WEB_CLIENT_URL` and `WASP_SERVER_URL` equivalents, e.g.:

- `https://app.memoato.com`
- `https://api.memoato.com/auth/google/callback`

## Raw-entry MCP ingest (optional)

Memoato can accept private raw life-log entries from a local MCP server or automation.

Recommended auth:

1. Sign in to Memoato.
2. Open Profile.
3. Create an API key under API keys.
4. Copy the key once and use it as `MEMOATO_MCP_TOKEN` in the local MCP server.

API keys are stored as hashes, are scoped to `raw_entry:write`, and can be revoked or given an expiry.

Legacy server env bootstrap is still supported:

```bash
MEMOATO_MCP_TOKEN="generate-a-long-random-token"
MEMOATO_MCP_USER_EMAIL="you@example.com"
```

Use exactly one user selector when using the legacy server env token:

- `MEMOATO_MCP_USER_ID`
- `MEMOATO_MCP_USER_EMAIL`
- `MEMOATO_MCP_USERNAME`

Optional background interpretation via OpenRouter:

```bash
OPENROUTER_API_KEY="..."
MEMOATO_AI_MODEL="google/gemini-3.1-flash-lite"
MEMOATO_AI_FALLBACK_MODEL="openai/gpt-4.1-mini"
```

Do not commit real values. The API endpoint is:

```http
POST /api/raw-entry
Authorization: Bearer <MEMOATO_MCP_TOKEN>
Content-Type: application/json
```

Payload:

```json
{
  "text": "Odradia sobnu biciklu 10 min, 2x10 listove i 2x2 zgibove",
  "occurredAt": "2026-06-08T15:17:00+02:00",
  "source": "mcp"
}
```

The server always stores the raw note and a durable processing run in one transaction before interpretation starts. Local deterministic extraction runs first. OpenRouter is called only when the local reading is empty, uncertain, or a longer entry appears to contain multiple facts. A timeout or provider failure cannot remove the original entry.

Local MCP server:

```bash
cd tools/memoato-mcp
npm install
npm run build
MEMOATO_API_ORIGIN="https://api.memoato.com" MEMOATO_MCP_TOKEN="..." node dist/server.js
```
