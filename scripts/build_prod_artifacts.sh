#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

if [[ -f .env.client ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.client
  set +a
fi
: "${REACT_APP_API_URL:=https://api.memoato.com}"

# Prisma migrations/generation require DATABASE_URL (and friends). Keep secrets
# out of git, but allow local/prod deploys to source them when present.
if [[ -f .env.server ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.server
  set +a
fi

wasp build
node scripts/patch_wasp_email_templates.mjs
node scripts/patch_wasp_verify_email_autologin.mjs
node scripts/patch_wasp_email_login_allow_unverified.mjs

# Wasp's generated projects rely on devDependencies for TypeScript bundling
# (e.g. @tsconfig/node22). In some prod environments NODE_ENV=production causes
# npm to omit dev deps, which breaks the build, so we force dev deps on.
NODE_ENV=development npm --prefix .wasp/build/server install --production=false
NODE_ENV=development npm --prefix .wasp/build/web-app install --production=false

# Ensure `wasp/*` imports inside the generated projects resolve locally (avoids
# TS type identity conflicts caused by resolving `wasp` from the repo root).
npm --prefix .wasp/build/server install .wasp/out/sdk/wasp --no-save
npm --prefix .wasp/build/web-app install .wasp/out/sdk/wasp --no-save

# Avoid TS type identity conflicts by ensuring the web build resolves
# `@tanstack/react-query` from the same place as `wasp/client/operations`.
rm -rf .wasp/build/web-app/node_modules/@tanstack

# Apply any pending migrations before bundling.
(cd .wasp/build/server && npx prisma migrate deploy --schema='../db/schema.prisma')

# Prisma client generation is required before bundling the server.
(cd .wasp/build/server && npx prisma generate --schema='../db/schema.prisma')

npm --prefix .wasp/build/server run bundle

# Build the web app with the correct API URL baked in.
REACT_APP_API_URL="${REACT_APP_API_URL}" npm --prefix .wasp/build/web-app run build
