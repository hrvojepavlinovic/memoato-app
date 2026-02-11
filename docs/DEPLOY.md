# Deploy (PM2 + Cloudflare Tunnel)

## Build

```bash
./scripts/deploy_prod.sh
```

`./scripts/deploy_prod.sh` runs `scripts/build_prod_artifacts.sh`, which:

- runs `wasp build`
- applies small patches to Wasp-generated code (see `docs/WASP_NOTES.md`)
- installs generated project deps
- runs Prisma migrations and bundles the server and web app

## Standard workflow (commit → push → deploy)

This repo is open source: **every push is public**.

For each change:

1. Run tests (at minimum): `npm test`
2. Commit + push:
   - Landing (Astro) deploys automatically on push to `main` via Cloudflare Pages (“Connect to Git”).
3. Deploy App (Wasp) on the server:
   - `./scripts/deploy_prod.sh`
   - This builds Wasp artifacts, runs Prisma migrations (`migrate deploy`), publishes a new immutable release under `deploy/releases/`, repoints `deploy/current`, then restarts PM2 processes.

## Environment

Create `.env.server` based on `.env.server.example` and fill:

- `DATABASE_URL` (Postgres socket DSN)
- `WASP_SERVER_URL`, `WASP_WEB_CLIENT_URL`, `JWT_SECRET`
- `SMTP_*` (required for email verification + password reset emails)
- (optional) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google login)

Create `.env.client` based on `.env.client.example` (used at build time):

- `REACT_APP_API_URL` (recommended: `https://api.memoato.com`)

## Analytics verification (Databuddy)

Databuddy is loaded client-side at runtime (React injects the Databuddy `<script>` from `src/shared/components/Databuddy.tsx`)
when `REACT_APP_DATABUDDY_CLIENT_ID` is set in `.env.client`.

Sanity checks:

- Confirm the browser sends events:
  - DevTools → Network → look for requests to `https://basket.databuddy.cc/...`.

Notes:

- Events can be blocked by ad blockers / privacy tools.
- If Databuddy dashboard still shows “No tracking detected”, verify the Databuddy website settings allow origin `https://app.memoato.com`.

## Run with PM2

```bash
pm2 delete memoato-api memoato-web || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Local ports:

- Web: `http://127.0.0.1:5050`
- API: `http://127.0.0.1:5051`

## Non-breaking deployments

`memoato-web` / `memoato-api` run from `deploy/current` (a symlink to the latest built release under `deploy/releases/`),
so rebuilding `.wasp/build` won’t delete files the running app is using.

## Cloudflare Tunnel

This repo includes a tunnel config template at `deploy/cloudflared-memoato.example.yml`.

Memoato production uses an **externally managed** Cloudflare Tunnel (HP/HP-dev) for:

- `app.memoato.com` → `http://127.0.0.1:5050`
- `api.memoato.com` → `http://127.0.0.1:5051`

If you choose to run a dedicated tunnel from this repo instead, use the template config and run it with:

```bash
cloudflared tunnel --config deploy/cloudflared-memoato.yml --no-autoupdate run <tunnel-name>
```

## Landing (memoato.com)

The landing site is deployed via Cloudflare Pages “Connect to Git” from `apps/memoato-site/` (Astro).

- Handover: `docs/LANDING_HANDOVER.md`

## Auth button color (Wasp default is yellow)

Wasp auth forms ship with a yellow “brand” color. Memoato overrides this to black via CSS variables in `src/App.css`.

If buttons look yellow again after changes, redeploy or restart:

```bash
./scripts/deploy_prod.sh
# or (no rebuild)
pm2 restart memoato-web --update-env
pm2 restart memoato-api --update-env
```

## Vite preview allowed hosts (dev-only)

If you run `wasp start` / `vite preview` locally behind Cloudflare and see:

`Blocked request. This host ("app.memoato.com") is not allowed.`

add the hostname(s) to `vite.config.ts` under `preview.allowedHosts`.

### DNS

If you can’t (or don’t want to) use `cloudflared tunnel route dns` (e.g. zone is in a different Cloudflare account),
create CNAME records in the Cloudflare dashboard for `memoato.com`:

- `app` → `<TUNNEL_UUID>.cfargotunnel.com`
- `api` → `<TUNNEL_UUID>.cfargotunnel.com`
- (optional) `dev` → `<TUNNEL_UUID>.cfargotunnel.com`
- (optional) `api-dev` → `<TUNNEL_UUID>.cfargotunnel.com`

Or (if the zone is in the same account as your `cloudflared` login), use:

```bash
cloudflared tunnel route dns -f memoato app.memoato.com
cloudflared tunnel route dns -f memoato api.memoato.com
```

If this prints something like `app.memoato.com.playgrnd.app`, your `cloudflared` login doesn’t have the `memoato.com` zone. Use the manual CNAME approach above in the Cloudflare dashboard.
