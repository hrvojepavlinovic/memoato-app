# Self-hosting

This is a practical guide for running memoato on your own server.

## Requirements

- Node.js (LTS)
- Wasp (https://wasp.sh)
- Postgres (local or remote)
- (Optional) PM2
- (Optional) Cloudflare Tunnel

## Local development

1. Copy env examples:
   - `cp .env.server.example .env.server`
   - `cp .env.client.example .env.client`
2. Set at minimum:
   - `DATABASE_URL` in `.env.server`
   - `JWT_SECRET` in `.env.server`
3. Run:
   - `wasp db migrate-dev`
   - `wasp start`

## Production (PM2)

1. Create `.env.server` and `.env.client`.
2. Build + deploy:
   - `./scripts/deploy_prod.sh`
3. Start PM2 processes:
   - `pm2 start deploy/ecosystem.config.cjs`
   - `pm2 save`

See `docs/DEPLOY.md` for domain/tunnel notes.

