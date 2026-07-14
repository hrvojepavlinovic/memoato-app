# Hetzner Migration

This is the target shape for moving Memoato off the HP laptop and onto Hetzner.

## Source Of Truth

- Active production repo: `memoato-app`
- Current production branch on HP: `main`
- Current runtime on HP: PM2 with `memoato-web` and `memoato-api`
- Current local ports on HP:
  - web: `127.0.0.1:5050`
  - api: `0.0.0.0:5051`
- Current database on HP:
  - database: `memoato`
  - owner/user currently used on HP: `harvey`

## Target Shape On Hetzner

- Runtime path: `/srv/apps/memoato/`
- Repo checkout path: `/srv/apps/memoato/app`
- Release path: `/srv/apps/memoato/releases/<timestamp>`
- Current symlink: `/srv/apps/memoato/current`
- Shared secrets path: `/srv/apps/memoato/shared/.env.server`
- Process supervision: `systemd`
- Public ingress: `Caddy`
- Bind addresses:
  - web: `127.0.0.1:5050`
  - api: `127.0.0.1:5051`

Temporary validation hostnames before production cutover:

- `hetzner-app.memoato.com`
- `hetzner-api.memoato.com`

## Release Retention

- `scripts/publish_release.sh` now runs `scripts/prune_releases.sh`
- Default retention: keep the newest `3` releases
- Override with `MEMOATO_RELEASES_TO_KEEP=<n>`
- Set `MEMOATO_RELEASES_TO_KEEP=0` to disable pruning

This keeps the release tree from growing without bound on Hetzner.

## Inputs Gathered From HP

Collected locally for migration prep under `.local/hetzner-migration/`:

- `env.server.hp`
- `env.client.hp`
- `db-metadata.hp.txt`
- `memoato.hp.dump`

These files are git-ignored and must not be committed.

## Environment Notes

HP runtime currently includes these server env keys:

- `DATABASE_URL`
- `NODE_ENV`
- `PORT`
- `WASP_SERVER_URL`
- `WASP_WEB_CLIENT_URL`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_PORT`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

HP runtime currently includes these client env keys:

- `REACT_APP_API_URL`

The example env files in this repo are expected to track these live key names.

Important note:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` were present on HP during inventory. Validate whether they are still needed before copying them forward unchanged.

## Next Step

Before touching Hetzner, confirm:

1. The intended production domain cutover plan for `app.memoato.com` and `api.memoato.com`
2. The target PostgreSQL role/database names on Hetzner
3. Whether SMTP and OAuth secrets should stay identical or be rotated during migration

Helpful repo-side references:

- `deploy/memoato-api.service.example`
- `deploy/memoato-web.service.example`
- `deploy/Caddyfile.memoato.example`
- `.github/workflows/deploy-hetzner.yml`
- `scripts/hetzner/deploy-memoato.sh`
- `scripts/hetzner/list-memoato-releases.sh`
- `scripts/hetzner/rollback-memoato-release.sh`

## GitHub Actions Deploy Model

The repo now follows the same deploy pattern as MAYIC:

- Trigger: push to `main` or manual `workflow_dispatch`
- GitHub Actions only opens SSH and triggers the remote deploy user
- The actual deploy logic lives entirely on Hetzner
- Build location: Hetzner, not GitHub Actions
- Secrets stay server-side in `/srv/apps/memoato/shared/`

Expected GitHub repository secret:

- `HETZNER_DEPLOY_KEY`

Expected server-side layout for the deploy script:

- app checkout: `/srv/apps/memoato/app`
- shared env files:
  - `/srv/apps/memoato/shared/.env.server`
  - `/srv/apps/memoato/shared/.env.client`
- deploy user home: `/home/deploy`

Server-side deploy flow:

1. GitHub Actions SSHes to `deploy@91.98.33.74`
2. The deploy key is restricted with a forced command
3. That forced command runs `scripts/hetzner/deploy-memoato.sh`
4. Hetzner checkout fetches and hard-resets to `origin/main`
5. Shared env files are linked into the checkout
6. Build runs on Hetzner
7. New release is published
8. Old releases are pruned
9. `memoato-api` and `memoato-web` are restarted via `systemd`

The deploy user needs permission to restart those two services, usually through a narrow `sudoers` rule.

This is intentionally close to MAYIC so one production deploy pattern is reused across apps.
