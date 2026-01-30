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
