# Memoato

Fast, minimal habit tracking for ADHD brains: quick input, clear progress, fewer decisions.

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

## What it is

- **Categories** with goals + charts (bar totals or line values)
- **Manual category ordering** on Home (drag-and-drop reorder mode)
- **Timeline** view with human-readable daily summaries
- **Privacy options** (cloud sync / encrypted cloud / local-only)
- **PWA-ready** (Add to Home Screen)

## Prerequisites

- **Node.js** (newest LTS version recommended): We recommend install Node through a Node version manager, e.g. `nvm`.
- **Wasp** (latest version): Install via
  ```sh
  curl -sSL https://get.wasp.sh/installer.sh | sh
  ```

## Development

## Codex usage (local)

If you use Codex CLI to work on this repo, see `docs/CODEX_HANDOVER.md` for:
- Running Codex with full permissions (no approvals/sandbox)
- Telegram notification helper (`send-telegram-message`)

Local setup details live in `docs/DEV_SETUP.md`. Quick start:

1. `wasp db migrate-dev`
2. `wasp start`
3. Open `http://localhost:3000`

To improve your Wasp development experience, we recommend installing the [Wasp extension for VSCode](https://marketplace.visualstudio.com/items?itemName=wasp-lang.wasp).

## Deployment

- Production deployment is documented in `docs/DEPLOY.md`.
- The deploy script is `scripts/deploy_prod.sh` (builds, runs Prisma migrations, publishes a release, restarts PM2).

## Analytics (Databuddy)

- Databuddy is integrated **client-side only** via runtime script injection in `src/shared/components/Databuddy.tsx`.
- There is **no server-side proxy** and no `/operations/track-databuddy` endpoint (it should return `404`).

Quick prod sanity checks:

- Browser DevTools → Network → confirm requests to `https://basket.databuddy.cc/...` (may be blocked by ad blockers).

## Landing (memoato.com)

The landing site lives in `apps/memoato-site/` (Astro) and is deployed via Cloudflare Pages “Connect to Git”.

## Contributing

See `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

## Security

See `SECURITY.md`.

## License

See `LICENSE`.

## References

- Wasp: `https://wasp.sh`
- Prisma: `https://www.prisma.io`
- PM2: `https://pm2.keymetrics.io`
- Cloudflare Pages: `https://pages.cloudflare.com`
- Cloudflare Tunnel: `https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/`
- Databuddy: `https://databuddy.cc`
