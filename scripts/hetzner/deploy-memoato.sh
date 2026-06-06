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

log_failure_tail() {
  local step="$1"
  local log_file="$2"

  echo "${step} failed. Showing the last 120 log lines:" >&2
  tail -n 120 "${log_file}" >&2 || true
}

run_quiet_step() {
  local step="$1"
  local log_file
  shift

  log_file="$(mktemp)"
  if ! "$@" >"${log_file}" 2>&1; then
    log_failure_tail "${step}" "${log_file}"
    rm -f "${log_file}"
    exit 1
  fi

  rm -f "${log_file}"
  echo "${step} ok"
}

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

git fetch --quiet origin main
target_commit="$(git rev-parse --short origin/main)"
git reset --hard --quiet origin/main
echo "Checked out origin/main at ${target_commit}"

ln -sfn "${SERVER_ENV}" "${REPO_DIR}/.env.server"
ln -sfn "${CLIENT_ENV}" "${REPO_DIR}/.env.client"
echo "Linked shared environment files"

run_quiet_step "Build" ./scripts/build_prod_artifacts.sh
run_quiet_step "Publish" ./scripts/publish_release.sh

sudo systemctl restart "${API_SERVICE}" "${WEB_SERVICE}"
sudo systemctl is-active --quiet "${API_SERVICE}"
sudo systemctl is-active --quiet "${WEB_SERVICE}"
echo "Services active: ${API_SERVICE}, ${WEB_SERVICE}"
