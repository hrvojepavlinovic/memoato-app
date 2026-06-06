#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_dir="${repo_root}/apps/memoato-site"
build_dir="${site_dir}/dist"
releases_dir="${MEMOATO_SITE_RELEASES_DIR:-/srv/apps/memoato-site/releases}"
current_link="${MEMOATO_SITE_CURRENT_LINK:-/srv/apps/memoato-site/current}"
keep_count="${MEMOATO_SITE_RELEASES_TO_KEEP:-3}"

if [[ ! -d "${build_dir}" ]]; then
  echo "Missing landing build output at ${build_dir}. Run ./scripts/build_memoato_site.sh first." >&2
  exit 1
fi

mkdir -p "${releases_dir}"

ts="$(date -u +%Y%m%d%H%M%S)"
release_dir="${releases_dir}/${ts}"
tmp_link_dir="$(dirname "${current_link}")"
tmp_link="${tmp_link_dir}/.current_tmp"

mkdir -p "${release_dir}"

rsync -a --delete "${build_dir}/" "${release_dir}/"

rm -f "${tmp_link}"
ln -s "${release_dir}" "${tmp_link}"
rm -f "${current_link}"
mv -f "${tmp_link}" "${current_link}"

MEMOATO_RELEASES_TO_KEEP="${keep_count}" \
MEMOATO_RELEASES_DIR="${releases_dir}" \
MEMOATO_CURRENT_LINK="${current_link}" \
  "${repo_root}/scripts/prune_releases.sh"

echo "Published landing release: ${release_dir}"
