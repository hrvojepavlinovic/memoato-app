#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

build_dir="${repo_root}/.wasp/build"
releases_dir="${repo_root}/deploy/releases"
current_link="${repo_root}/deploy/current"

if [[ ! -d "${build_dir}/server" || ! -d "${build_dir}/web-app" ]]; then
  echo "Missing build output at ${build_dir}. Run ./scripts/build_prod_artifacts.sh first." >&2
  exit 1
fi

mkdir -p "${releases_dir}"

ts="$(date -u +%Y%m%d%H%M%S)"
release_dir="${releases_dir}/${ts}"
tmp_link="${repo_root}/deploy/.current_tmp"

mkdir -p "${release_dir}"

# Copy build output into an immutable release directory.
rsync -a --delete "${build_dir}/" "${release_dir}/"

# Atomically repoint deploy/current to the new release.
rm -f "${tmp_link}"
ln -s "${release_dir}" "${tmp_link}"
mv -Tf "${tmp_link}" "${current_link}"

echo "Published release: ${release_dir}"
