#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

: "${WEB_PORT:=3000}"
: "${MEMOATO_RELEASE_DIR:=${repo_root}/.wasp/build}"

exec node "${repo_root}/scripts/serve_web_build.mjs" --dir "${MEMOATO_RELEASE_DIR}/web-app/build" --host 127.0.0.1 --port "${WEB_PORT}"
