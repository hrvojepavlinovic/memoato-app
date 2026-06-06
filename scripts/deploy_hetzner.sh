#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

shared_dir="${MEMOATO_SHARED_DIR:-/srv/apps/memoato/shared}"
server_env_target="${shared_dir}/.env.server"
client_env_target="${shared_dir}/.env.client"
releases_to_keep="${MEMOATO_RELEASES_TO_KEEP:-3}"
api_service="${MEMOATO_API_SERVICE:-memoato-api}"
web_service="${MEMOATO_WEB_SERVICE:-memoato-web}"

if [[ ! -f "${server_env_target}" ]]; then
  echo "Missing server env file: ${server_env_target}" >&2
  exit 1
fi

if [[ ! -f "${client_env_target}" ]]; then
  echo "Missing client env file: ${client_env_target}" >&2
  exit 1
fi

ln -sfn "${server_env_target}" "${repo_root}/.env.server"
ln -sfn "${client_env_target}" "${repo_root}/.env.client"

MEMOATO_RELEASES_TO_KEEP="${releases_to_keep}" ./scripts/build_prod_artifacts.sh
MEMOATO_RELEASES_TO_KEEP="${releases_to_keep}" ./scripts/publish_release.sh

sudo systemctl restart "${api_service}" "${web_service}"
sudo systemctl --no-pager --full status "${api_service}" "${web_service}"
