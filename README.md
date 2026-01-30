# Memoato

- Product spec: `docs/PRODUCT_SPEC.md`
- Import plan (JSON export): `docs/IMPORT_PLAN.md`
- Dev setup (Postgres socket + Wasp): `docs/DEV_SETUP.md`
- Deploy (PM2 + Cloudflare Tunnel): `docs/DEPLOY.md`
- Architecture: `docs/ARCHITECTURE.md`
- Self-hosting: `docs/SELF_HOSTING.md`
- Landing handover (Astro + Cloudflare Pages): `docs/LANDING_HANDOVER.md`
- Open-source checklist: `docs/OPEN_SOURCE_TASKS.md`
- Backlog: `docs/BACKLOG.md`
- Community feedback/voting proposal: `docs/COMMUNITY_FEEDBACK.md`
- Marketing on X: `docs/MARKETING_X.md`

## Prerequisites

- **Node.js** (newest LTS version recommended): We recommend install Node through a Node version manager, e.g. `nvm`.
- **Wasp** (latest version): Install via
  ```sh
  curl -sSL https://get.wasp.sh/installer.sh | sh
  ```

## Development

To start the application locally for development or preview purposes:

1. Run `wasp db migrate-dev` to migrate the database to the latest migration
2. Run `wasp start` to start the Wasp application. If running for the first time, this will also install the client and the server dependencies for you.
3. The application should be running on `localhost:3000`. Open in it your browser to access the client.

To improve your Wasp development experience, we recommend installing the [Wasp extension for VSCode](https://marketplace.visualstudio.com/items?itemName=wasp-lang.wasp).

## Analytics (Databuddy)

- Databuddy is integrated **client-side only** via runtime script injection in `src/shared/components/Databuddy.tsx`.
- There is **no server-side proxy** and no `/operations/track-databuddy` endpoint (it should return `404`).

Quick prod sanity checks:

- Browser DevTools → Network → confirm requests to `https://basket.databuddy.cc/...` (may be blocked by ad blockers).

## Landing (memoato.com)

The landing site lives in `apps/memoato-site/` (Astro) and is deployed via Cloudflare Pages “Connect to Git”.

## Learn more

To find out more about Wasp, visit out [docs](https://wasp.sh/docs).
