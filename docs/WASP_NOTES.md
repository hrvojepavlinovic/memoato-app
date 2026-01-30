# Wasp notes (for this repo)

## Where things live

- `main.wasp`: app “wiring” (routes/pages, auth, queries/actions).
- `schema.prisma`: data model (Wasp uses Prisma under the hood).
- `src/`: React client + server code referenced from `main.wasp`.

## Key Wasp concepts

- `route` + `page`: define client routes and their React components.
- `query`: server-side read function that the client can call (and cache).
- `action`: server-side write/mutation function.
- `auth`: enables Wasp Auth; user entity is defined in Prisma schema.

## Useful commands

```bash
wasp start
wasp db migrate-dev
wasp db studio
```

## Build-time patches

This repo applies small patches to Wasp-generated code after `wasp build` (see `scripts/build_prod_artifacts.sh`):

- Email templates branding
- Auto-login after email verification
- Allow unverified users to log in (product choice; the UI still nudges verification)

## Web ↔ API URL in production

The web app runs in the user’s browser, so it must call the API via the public URL (`https://api.memoato.com`), not `localhost`.
`localhost` would mean “the user’s laptop”, not this server.
