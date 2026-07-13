# Memoato

A private memory layer for the details of your life. Write what happened in your own words; Memoato preserves the original, extracts useful facts, and helps you recall the context later.

- Product spec: `docs/PRODUCT_SPEC.md`
- Import plan (JSON export): `docs/IMPORT_PLAN.md`
- Dev setup (Postgres socket + Wasp): `docs/DEV_SETUP.md`
- Deploy (Hetzner + systemd + Caddy): `docs/DEPLOY.md`
- Architecture: `docs/ARCHITECTURE.md`
- Memoato 2.0 product + technical architecture: `docs/MEMOATO_2_PRODUCT_ARCHITECTURE.md`
- Trustworthy context product direction: `docs/TRUSTWORTHY_CONTEXT_PRODUCT.md`
- Trustworthy context schema/migration review: `docs/TRUSTWORTHY_CONTEXT_SCHEMA_PLAN.md`
- Trustworthy context handover: `docs/TRUSTWORTHY_CONTEXT_HANDOVER.md`
- Self-hosting: `docs/SELF_HOSTING.md`
- Landing handover (Astro + Cloudflare Pages): `docs/LANDING_HANDOVER.md`
- Mobile apps (Capacitor + TestFlight/Play): `docs/MOBILE.md`
- Open-source checklist: `docs/OPEN_SOURCE_TASKS.md`
- Backlog: `docs/BACKLOG.md`
- Community feedback/voting proposal: `docs/COMMUNITY_FEEDBACK.md`
- Marketing on X: `docs/MARKETING_X.md`

## What it is

- **Raw-first capture** with the original entry as the source of truth
- **Memory review** for visible, correctable extracted facts
- **Evidence-first recall** across raw entries, facts and legacy events
- **Views** with the existing categories, goals, charts and schedules
- **Deterministic-first processing** with OpenRouter only when useful
- **Privacy options** (cloud sync / encrypted cloud / local-only)
- **Scoped MCP/API access** for logging, recall, or both
- **PWA-ready** (Add to Home Screen)

The current personal memory product is the first workspace in a broader trustworthy context system. The research behind that direction is public at [guide.hills-lab.hr](https://guide.hills-lab.hr).

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
- The current production path deploys to Hetzner via `.github/workflows/deploy-hetzner.yml` and the server-side `scripts/hetzner/deploy-memoato.sh`.

## Analytics (Databuddy)

- Databuddy is integrated **client-side only** via runtime script injection in `src/shared/components/Databuddy.tsx`.
- There is **no server-side proxy** and no `/operations/track-databuddy` endpoint (it should return `404`).

Quick prod sanity checks:

- Browser DevTools → Network → confirm requests to `https://basket.databuddy.cc/...` (may be blocked by ad blockers).

## Landing (memoato.com)

The landing site lives in `apps/memoato-site/` (Astro). It was originally deployed via Cloudflare Pages, but the Hetzner deployment flow can now build and publish it alongside the main app/API. Current production landing origin is Hetzner.

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
