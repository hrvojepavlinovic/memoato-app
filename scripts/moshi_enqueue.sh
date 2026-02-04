#!/usr/bin/env bash
set -euo pipefail

title="${1:-Task Update}"
message="${2:-Done}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
outbox_dir="${MOSHI_OUTBOX_DIR:-${repo_root}/deploy/moshi_outbox}"
mkdir -p "${outbox_dir}"

ts="$(date -u +%Y%m%d%H%M%S)"
rand="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(3))
PY
)"
file="${outbox_dir}/${ts}_${rand}.json"

python3 - "$title" "$message" >"${file}" <<'PY'
import json, sys
title = sys.argv[1]
message = sys.argv[2]
print(json.dumps({"title": title, "message": message}))
PY

echo "[moshi_enqueue] queued: ${file}" >&2

