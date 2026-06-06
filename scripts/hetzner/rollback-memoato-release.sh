#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/srv/apps/memoato"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
API_SERVICE="${MEMOATO_API_SERVICE:-memoato-api}"
WEB_SERVICE="${MEMOATO_WEB_SERVICE:-memoato-web}"

target="${1:-}"

if [[ -z "${target}" ]]; then
  echo "Usage: bash scripts/hetzner/rollback-memoato-release.sh <release-id-or-full-path>"
  exit 1
fi

if [[ "${target}" != /* ]]; then
  target="${RELEASES_DIR}/${target}"
fi

if [[ ! -d "${target}" ]]; then
  echo "Release not found: ${target}"
  exit 1
fi

ln -sfn "${target}" "${CURRENT_LINK}"
sudo systemctl restart "${API_SERVICE}" "${WEB_SERVICE}"
sudo systemctl --no-pager --full status "${API_SERVICE}" "${WEB_SERVICE}" | sed -n '1,20p'
