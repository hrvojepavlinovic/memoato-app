#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

build_dir="${repo_root}/.wasp/build"
releases_dir="${MEMOATO_RELEASES_DIR:-${repo_root}/deploy/releases}"
current_link="${MEMOATO_CURRENT_LINK:-${repo_root}/deploy/current}"
keep_count="${MEMOATO_RELEASES_TO_KEEP:-3}"

if [[ ! -d "${build_dir}/server" || ! -d "${build_dir}/web-app" ]]; then
  echo "Missing build output at ${build_dir}. Run ./scripts/build_prod_artifacts.sh first." >&2
  exit 1
fi

mkdir -p "${releases_dir}"

ts="$(date -u +%Y%m%d%H%M%S)"
release_dir="${releases_dir}/${ts}"
tmp_link_dir="$(dirname "${current_link}")"
tmp_link="${tmp_link_dir}/.current_tmp"

mkdir -p "${release_dir}"

echo "Publishing release into ${release_dir}"
echo "Updating current symlink at ${current_link}"

# Copy build output into an immutable release directory.
rsync -a --delete "${build_dir}/" "${release_dir}/"

# The bundled Wasp server can still resolve some runtime dependencies from the
# repo root (for example app-level auth/validation packages). Expose the root
# node_modules one level above the generated server package so Node's normal
# resolution can find them.
ln -sfn "${repo_root}/node_modules" "${release_dir}/node_modules"

# Atomically repoint deploy/current to the new release.
rm -f "${tmp_link}"
ln -s "${release_dir}" "${tmp_link}"
rm -f "${current_link}"
mv -f "${tmp_link}" "${current_link}"

echo "Published release: ${release_dir}"

MEMOATO_RELEASES_TO_KEEP="${keep_count}" "${repo_root}/scripts/prune_releases.sh"
