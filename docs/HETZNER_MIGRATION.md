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
- `REACT_APP_DATABUDDY_CLIENT_ID`

The example env files in this repo are expected to track these live key names.

Important note:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `REACT_APP_DATABUDDY_CLIENT_ID` were present on HP during inventory, but they do not currently appear referenced in this repo. Validate whether they are still needed before copying them forward unchanged.

## Next Step

Before touching Hetzner, confirm:

1. The intended production domain cutover plan for `app.memoato.com` and `api.memoato.com`
2. The target PostgreSQL role/database names on Hetzner
3. Whether SMTP and OAuth secrets should stay identical or be rotated during migration

Helpful repo-side references:

- `deploy/memoato-api.service.example`
- `deploy/memoato-web.service.example`
- `deploy/Caddyfile.memoato.example`
