#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

# Wasp's compile phase needs repo-level devDependencies even in production deploys.
original_node_env="${NODE_ENV-}"
export NODE_ENV=development
export NPM_CONFIG_INCLUDE=dev

# The Wasp build now relies on the repo-level Vite config and its devDependencies.
if [[ -f package-lock.json ]]; then
  npm ci --include=dev
else
  npm install --include=dev
fi

wasp build

if [[ -n "${original_node_env}" ]]; then
  export NODE_ENV="${original_node_env}"
else
  unset NODE_ENV
fi
unset NPM_CONFIG_INCLUDE

node scripts/patch_wasp_email_templates.mjs
node scripts/patch_wasp_verify_email_autologin.mjs
node scripts/patch_wasp_oauth_types.mjs
node scripts/patch_wasp_oauth_profile_sync.mjs

# Wasp's generated projects rely on devDependencies for TypeScript bundling
# (e.g. @tsconfig/node22). Ensure dev deps stay installed even if the environment
# defaults to omitting them.
npm --prefix .wasp/build/server install --include=dev
npm --prefix .wasp/build/web-app install --include=dev

# Ensure `wasp/*` imports inside the generated projects resolve locally (avoids
# TS type identity conflicts caused by resolving `wasp` from the repo root).
npm --prefix .wasp/build/server install .wasp/out/sdk/wasp --no-save --include=dev
npm --prefix .wasp/build/web-app install .wasp/out/sdk/wasp --no-save --include=dev

# Wasp 0.20 currently emits vulnerable mail/logger ranges. Pin the generated
# production server to patched releases after all other installs, until the
# generator itself is upgraded.
npm --prefix .wasp/build/server install nodemailer@9.0.3 morgan@1.11.0 --no-save --include=dev

# Avoid TS type identity conflicts by ensuring the web build resolves
# `@tanstack/react-query` from the same place as `wasp/client/operations`.
rm -rf .wasp/build/web-app/node_modules/@tanstack

# Only expose runtime secrets after all dependency lifecycle scripts have run.
# The generated application is trusted at this point; third-party installers are not.
if [[ -f .env.server ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.server
  set +a
fi

if [[ -f .env.client ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.client
  set +a
fi
: "${REACT_APP_API_URL:=https://api.memoato.com}"

# Apply any pending migrations before bundling.
(cd .wasp/build/server && npx prisma migrate deploy --schema='../db/schema.prisma')

# Prisma client generation is required before bundling the server.
(cd .wasp/build/server && npx prisma generate --schema='../db/schema.prisma')

npm --prefix .wasp/build/server run bundle

# Build the web app with the correct API URL baked in.
REACT_APP_API_URL="${REACT_APP_API_URL}" npm --prefix .wasp/build/web-app run build
