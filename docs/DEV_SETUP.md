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
