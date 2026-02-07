# memoato.com landing (handover)

## What it is
Static marketing site (Astro) served from Cloudflare Pages.

- Code: `apps/memoato-site/`
- Live domain: `memoato.com`
- App remains on: `https://app.memoato.com`

## Pages
- `/` Home
- `/about`
- `/help`
- `/blog` (Markdown files in `apps/memoato-site/src/pages/blog/`)
- `/privacy`
- `/terms`
- `/contact`
- `/open-source`

## Live stats
The home page fetches totals (users/categories/entries) from a same-origin Pages Function:

- Browser → `GET /api/totals`
- Pages Function → `POST https://api.memoato.com/operations/get-public-totals`

Implementation: `apps/memoato-site/functions/api/totals.ts`.

## Analytics (Databuddy)
Landing analytics is **client-side only** via `<script>` in `apps/memoato-site/src/layouts/BaseLayout.astro`.

Env var:
- `PUBLIC_DATABUDDY_CLIENT_ID` (use a dedicated Databuddy project for `memoato.com`)

## Assets
- Logo + favicons live in `apps/memoato-site/public/`
- Regenerate favicons/PWA icons (app + landing) from `public/logo.png` via:
  - `python3 scripts/generate_favicons.py --also-landing`
  - This also regenerates `favicon.ico` (note: browsers can cache it aggressively).
- Screenshot placeholders are referenced on the home page; recommended sizes:
  - Desktop hero: `1600×900` (16:9)
  - Mobile: `1080×1350` (4:5)
  - Keep under ~300KB per image where possible.

## Deployment (Cloudflare Pages)
Deployed via Cloudflare Pages “Connect to Git” on push to `main`.

Build settings:
- Root directory: `apps/memoato-site`
- Build command: `npm ci && npm run build`
- Output directory: `dist`

Pages environment variables:
- `PUBLIC_DATABUDDY_CLIENT_ID` (dedicated Databuddy project for `memoato.com`)
- `MEMOATO_API_ORIGIN` (optional; defaults to `https://api.memoato.com`)

## SEO + LLM discoverability
- `apps/memoato-site/public/robots.txt`
- `apps/memoato-site/src/pages/sitemap.xml.ts` → `/sitemap.xml`
- `apps/memoato-site/public/llms.txt`
- JSON-LD structured data is injected in `apps/memoato-site/src/layouts/BaseLayout.astro` and extended per page/layout.

## Local dev
```bash
cd apps/memoato-site
cp .env.example .env
npm install
npm run dev
```
