#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/srv/apps/memoato"
RELEASES_DIR="${APP_ROOT}/releases"

current_target="$(readlink -f "${APP_ROOT}/current" 2>/dev/null || true)"

find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d | sort -r | while read -r release; do
  if [[ "${release}" == "${current_target}" ]]; then
    printf "* %s (current)\n" "${release}"
  else
    printf "  %s\n" "${release}"
  fi
done
