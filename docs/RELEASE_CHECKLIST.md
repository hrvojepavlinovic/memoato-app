# Release checklist

## Before deploy

- Confirm no secrets are staged (`git status`, verify `.env*` is untracked)
- Run `npx tsc -p tsconfig.json --noEmit`
- If Prisma schema/migrations changed, run the appropriate DB migration steps
- Skim `pm2 logs memoato-api` for errors before restart

## Deploy

- `./scripts/deploy_prod.sh`
- Smoke check:
  - App loads: `https://app.memoato.com`
  - API reachable: `https://api.memoato.com/health` (or an existing operation)
  - Auth works (signup/login)

## After deploy

- Check PM2 status: `pm2 status`
- Check log sizes (pm2-logrotate): `pm2 logs --lines 50`

## Mobile releases

- See `docs/MOBILE.md` (TestFlight + Play Store workflow; do not commit signing assets).
