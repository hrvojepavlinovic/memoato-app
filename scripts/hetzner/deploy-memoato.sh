#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/srv/apps/memoato"
REPO_DIR="${APP_ROOT}/app"
RELEASES_DIR="${APP_ROOT}/releases"
CURRENT_LINK="${APP_ROOT}/current"
SHARED_DIR="${APP_ROOT}/shared"
SERVER_ENV="${SHARED_DIR}/.env.server"
CLIENT_ENV="${SHARED_DIR}/.env.client"
SITE_ROOT="${MEMOATO_SITE_ROOT:-/srv/apps/memoato-site}"
SITE_RELEASES_DIR="${SITE_ROOT}/releases"
SITE_CURRENT_LINK="${SITE_ROOT}/current"
API_SERVICE="${MEMOATO_API_SERVICE:-memoato-api}"
WEB_SERVICE="${MEMOATO_WEB_SERVICE:-memoato-web}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
export MEMOATO_RELEASES_TO_KEEP="${KEEP_RELEASES}"
export MEMOATO_RELEASES_DIR="${RELEASES_DIR}"
export MEMOATO_CURRENT_LINK="${CURRENT_LINK}"
export MEMOATO_SITE_RELEASES_TO_KEEP="${MEMOATO_SITE_RELEASES_TO_KEEP:-${KEEP_RELEASES}}"
export MEMOATO_SITE_RELEASES_DIR="${SITE_RELEASES_DIR}"
export MEMOATO_SITE_CURRENT_LINK="${SITE_CURRENT_LINK}"

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

verify_service_stable() {
  local service="$1"

  # `systemctl is-active` can briefly succeed while a crashing service is still
  # in its activation/restart cycle. Require it to remain fully running long
  # enough to catch missing native modules and other immediate startup errors.
  for _ in {1..10}; do
    if [[ "$(systemctl show --property=SubState --value "${service}")" != "running" ]]; then
      sudo systemctl --no-pager --full status "${service}" >&2 || true
      return 1
    fi
    sleep 1
  done
}

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

run_quiet_step "Build app" ./scripts/build_prod_artifacts.sh
run_quiet_step "Publish app" ./scripts/publish_release.sh
run_quiet_step "Build landing" ./scripts/build_memoato_site.sh
run_quiet_step "Publish landing" ./scripts/publish_memoato_site.sh

sudo systemctl restart "${API_SERVICE}" "${WEB_SERVICE}"
verify_service_stable "${API_SERVICE}"
verify_service_stable "${WEB_SERVICE}"
echo "Services active: ${API_SERVICE}, ${WEB_SERVICE}"
