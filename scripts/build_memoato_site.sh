#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_dir="${repo_root}/apps/memoato-site"

if [[ ! -d "${site_dir}" ]]; then
  echo "Landing site directory not found: ${site_dir}" >&2
  exit 1
fi

npm --prefix "${site_dir}" ci
npm --prefix "${site_dir}" run build
