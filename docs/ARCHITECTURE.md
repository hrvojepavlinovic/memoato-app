# Architecture

## Apps in this repo

- **App** (Wasp): root (`main.wasp`, `src/`)
  - React client (Vite)
  - Node.js API server
  - Prisma + Postgres
- **Landing** (Astro): `apps/memoato-site/`
  - Static pages + blog
  - Cloudflare Pages Function proxy for public totals (`/api/totals`)

## Data model (Prisma)

- `User`: account profile + role
  - Preferences: `nextUpEnabled`, `themePreference`, `quickLogFabSide`, `homeCategoryLayout`
  - Optional public stats share: `publicStatsEnabled`, `publicStatsToken`, `publicStatsCategoryIds`
- `Category`: a user-owned tracker (title/slug/type/period/goals/accent/emoji)
  - Optional `sortOrder` supports manual ordering on the Home dashboard.
- `CategoryTemplate`: preset category definitions used on “New category” (defaults, emoji, accent, goals, aggregation).
- `Event`: a logged data point (amount + timestamps) tied to a category
  - `Event(kind=NOTE)` is also the durable raw-memory source of truth.
- `MemoryFact`: normalized, reviewable interpretation linked back to a raw event.
- `MemoryProcessingRun`: durable extraction attempt and recovery state.
- `MemoryCorrection` + `MemoryAlias`: human correction audit and personal language mappings.
- `MemoryEntity` + `MemoryFactEntity`: extensible people/place/activity/topic graph.
- `MemoryInference`: evidence-backed suggestions kept separate from facts.

The memory tables are additive and rebuildable. They never replace `Event.rawText`. See `MEMOATO_2_PRODUCT_ARCHITECTURE.md` for the full contract and migration strategy.

Key timestamps:
- `createdAt`: when the record is created in memoato
- `occurredAt`: when the event happened (timestamp)
- `occurredOn`: date-only (for grouping by day)

## Auth

- Email auth via Wasp.
- Email verification is **required**, but the app allows usage immediately and shows an “unverified” indicator in the header until verified.
- Optional Google auth via Wasp OAuth.

## Deploy shape (production)

- `memoato-web` (PM2): serves the web client on `127.0.0.1:5050`
- `memoato-api` (PM2): serves the API on `127.0.0.1:5051`
- Cloudflare Tunnel maps `app.<domain>` + `api.<domain>` to those ports.
- Landing deploys separately via Cloudflare Pages.
