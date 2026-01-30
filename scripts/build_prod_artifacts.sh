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

wasp build
node scripts/patch_wasp_email_templates.mjs
node scripts/patch_wasp_verify_email_autologin.mjs
node scripts/patch_wasp_email_login_allow_unverified.mjs

npm --prefix .wasp/build/server install
npm --prefix .wasp/build/web-app install

# Ensure `wasp/*` imports inside the generated projects resolve locally (avoids
# TS type identity conflicts caused by resolving `wasp` from the repo root).
npm --prefix .wasp/build/server install .wasp/out/sdk/wasp --no-save
npm --prefix .wasp/build/web-app install .wasp/out/sdk/wasp --no-save

# Avoid TS type identity conflicts by ensuring the web build resolves
# `@tanstack/react-query` from the same place as `wasp/client/operations`.
rm -rf .wasp/build/web-app/node_modules/@tanstack

# Prisma client generation is required before bundling the server.
(cd .wasp/build/server && npx prisma generate --schema='../db/schema.prisma')

npm --prefix .wasp/build/server run bundle

# Build the web app with the correct API URL baked in.
REACT_APP_API_URL="${REACT_APP_API_URL}" npm --prefix .wasp/build/web-app run build
