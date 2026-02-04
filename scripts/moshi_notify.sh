#!/usr/bin/env bash
set -euo pipefail

title="${1:-Task Update}"
message="${2:-Done}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

if [[ -z "${MOSHI_WEBHOOK_TOKEN:-}" ]]; then
  dotenv_path="${DOTENV_CONFIG_PATH:-${repo_root}/.env.server}"
  if [[ -f "${dotenv_path}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${dotenv_path}"
    set +a
  fi
fi

if [[ -z "${MOSHI_WEBHOOK_TOKEN:-}" ]]; then
  echo "[moshi_notify] MOSHI_WEBHOOK_TOKEN not set; skipping." >&2
  exit 0
fi

moshi_url="${MOSHI_WEBHOOK_URL:-https://api.getmoshi.app/api/webhook}"

payload="$(
  python3 - "$title" "$message" <<'PY'
import json, os, sys
title = sys.argv[1]
message = sys.argv[2]
token = os.environ.get("MOSHI_WEBHOOK_TOKEN", "")
print(json.dumps({"token": token, "title": title, "message": message}))
PY
)"

curl -fsS -X POST "${moshi_url}" \
  -H "Content-Type: application/json" \
  -d "${payload}" >/dev/null
