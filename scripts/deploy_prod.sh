#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

./scripts/build_prod_artifacts.sh
./scripts/publish_release.sh

pm2 restart memoato-api --update-env
pm2 restart memoato-web --update-env
