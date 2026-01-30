# Contributing to memoato

Thanks for considering a contribution.

## Repo layout
- App (Wasp): `/` (root)
- Landing (Astro): `apps/memoato-site/`

## Development
App:
- Copy env examples:
  - `cp .env.server.example .env.server`
  - `cp .env.client.example .env.client`
- Start:
  - `wasp db migrate-dev`
  - `wasp start`

Landing:
- `cd apps/memoato-site`
- `cp .env.example .env`
- `npm install`
- `npm run dev`

## Code style

- Keep changes focused and easy to review.
- Prefer existing patterns and components.
- Avoid introducing new dependencies unless necessary.

## Pull requests
- Keep PRs focused and small.
- Avoid committing secrets (`.env*`, tokens, credentials).
- Include screenshots for UI changes when possible.
