#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/srv/apps/memoato"
REPO_DIR="${APP_ROOT}/app"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
SHARED_DIR="${APP_ROOT}/shared"
SERVER_ENV="${SHARED_DIR}/.env.server"
CLIENT_ENV="${SHARED_DIR}/.env.client"
API_SERVICE="${MEMOATO_API_SERVICE:-memoato-api}"
WEB_SERVICE="${MEMOATO_WEB_SERVICE:-memoato-web}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
export MEMOATO_RELEASES_TO_KEEP="${KEEP_RELEASES}"
export MEMOATO_RELEASES_DIR="${RELEASES_DIR}"
export MEMOATO_CURRENT_LINK="${CURRENT_LINK}"

export NVM_DIR="${HOME}/.nvm"
. "${NVM_DIR}/nvm.sh"
nvm use 24 >/dev/null
export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -f "${SERVER_ENV}" ]]; then
  echo "Missing server env file: ${SERVER_ENV}" >&2
  exit 1
fi

if [[ ! -f "${CLIENT_ENV}" ]]; then
  echo "Missing client env file: ${CLIENT_ENV}" >&2
  exit 1
fi

cd "${REPO_DIR}"

git fetch origin main
git reset --hard origin/main

ln -sfn "${SERVER_ENV}" "${REPO_DIR}/.env.server"
ln -sfn "${CLIENT_ENV}" "${REPO_DIR}/.env.client"

./scripts/build_prod_artifacts.sh
./scripts/publish_release.sh

sudo systemctl restart "${API_SERVICE}" "${WEB_SERVICE}"
sudo systemctl --no-pager --full status "${API_SERVICE}" "${WEB_SERVICE}" | sed -n '1,20p'
