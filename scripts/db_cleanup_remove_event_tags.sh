#!/usr/bin/env bash
set -euo pipefail

db_name="${1:-memoato}"
socket_dir="${PGHOST:-/var/run/postgresql}"
db_user="${PGUSER:-harvey}"

psql -h "${socket_dir}" -U "${db_user}" -d "${db_name}" -v ON_ERROR_STOP=1 -c \
  "UPDATE \"Event\" SET data = (data - 'tags') WHERE data IS NOT NULL AND (data ? 'tags');"

echo "Removed tags from Event.data in ${db_name}."

