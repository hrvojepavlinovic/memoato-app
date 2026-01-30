#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

: "${DOTENV_CONFIG_PATH:=${repo_root}/.env.server}"
: "${MEMOATO_RELEASE_DIR:=${repo_root}/.wasp/build}"

if [[ -f "${DOTENV_CONFIG_PATH}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${DOTENV_CONFIG_PATH}"
  set +a
fi

exec npm --prefix "${MEMOATO_RELEASE_DIR}/server" run start-production
