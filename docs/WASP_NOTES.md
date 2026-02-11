# Wasp notes (for this repo)

## Where things live

- `main.wasp`: app “wiring” (routes/pages, auth, queries/actions).
- `schema.prisma`: data model (Wasp uses Prisma under the hood).
- `src/`: React client + server code referenced from `main.wasp`.

## Key Wasp concepts

- `route` + `page`: define client routes and their React components.
- `query`: server-side read function that the client can call (and cache).
- `action`: server-side write/mutation function.
- `auth`: enables Wasp Auth. User entity is defined in Prisma schema.

## Useful commands

```bash
wasp start
wasp db migrate-dev
wasp db studio
```

## Build-time patches

This repo patches some Wasp-generated code after `wasp build` (see `scripts/build_prod_artifacts.sh`), before bundling.
This is intentionally small and scoped, but it is also fragile. If Wasp changes the generated file shapes, these patches can
stop applying.

If you upgrade Wasp, run a production build and confirm patch scripts report success.

Patches:

- `scripts/patch_wasp_email_templates.mjs`
  - Brand email templates (Memoato copy and links).
- `scripts/patch_wasp_verify_email_autologin.mjs`
  - Make verify-email return a `sessionId` so the app can auto-login after confirmation.
- `scripts/patch_wasp_email_login_allow_unverified.mjs`
  - Allow login before verification (product choice). The UI still nudges verification for email/password accounts.
- `scripts/patch_wasp_oauth_types.mjs`
  - Fix build-time TypeScript typing issues in Wasp OAuth generated handlers.
- `scripts/patch_wasp_oauth_profile_sync.mjs`
  - Sync OAuth profile fields into `User` (e.g. Google email into `User.email`) on login.

## Web ↔ API URL in production

The web app runs in the user’s browser, so it must call the API via the public URL (`https://api.memoato.com`), not `localhost`.
`localhost` would mean “the user’s laptop”, not this server.
