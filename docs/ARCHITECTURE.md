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
- `Category`: a user-owned tracker (title/slug/type/period/goals/accent/emoji)
  - Optional `sortOrder` supports manual ordering on the Home dashboard.
- `CategoryTemplate`: preset category definitions used on “New category” (defaults, emoji, accent, goals, aggregation).
- `Event`: a logged data point (amount + timestamps) tied to a category

Key timestamps:
- `createdAt`: when the record is created in memoato
- `occurredAt`: when the event happened (timestamp)
- `occurredOn`: date-only (for grouping by day)

## Auth

- Email auth via Wasp.
- Email verification is **required**, but the app allows usage immediately and shows an “unverified” indicator in the header until verified.

## Deploy shape (production)

- `memoato-web` (PM2): serves the web client on `127.0.0.1:5050`
- `memoato-api` (PM2): serves the API on `127.0.0.1:5051`
- Cloudflare Tunnel maps `app.<domain>` + `api.<domain>` to those ports.
- Landing deploys separately via Cloudflare Pages.
