#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
releases_dir="${MEMOATO_RELEASES_DIR:-${repo_root}/deploy/releases}"
current_link="${MEMOATO_CURRENT_LINK:-${repo_root}/deploy/current}"
keep_count="${MEMOATO_RELEASES_TO_KEEP:-3}"

if [[ ! "$keep_count" =~ ^[0-9]+$ ]]; then
  echo "MEMOATO_RELEASES_TO_KEEP must be a non-negative integer, got: $keep_count" >&2
  exit 1
fi

if [[ "$keep_count" -eq 0 ]]; then
  echo "Skipping release pruning because MEMOATO_RELEASES_TO_KEEP=0"
  exit 0
fi

if [[ ! -d "$releases_dir" ]]; then
  echo "No releases directory at $releases_dir, nothing to prune."
  exit 0
fi

current_target=""
if [[ -L "$current_link" ]]; then
  current_target="$(cd "$(dirname "$current_link")" && readlink "$current_link")"
  if [[ "$current_target" != /* ]]; then
    current_target="$(cd "$(dirname "$current_link")" && cd "$(dirname "$current_target")" && pwd)/$(basename "$current_target")"
  fi
fi

release_dirs=()
while IFS= read -r dir; do
  release_dirs+=("$dir")
done < <(
  for dir in "$releases_dir"/*; do
    [[ -d "$dir" ]] || continue
    printf '%s\n' "$dir"
  done | LC_ALL=C sort -r
)

if [[ "${#release_dirs[@]}" -le "$keep_count" ]]; then
  echo "Keeping ${#release_dirs[@]} release(s); no pruning needed."
  exit 0
fi

keep_dirs=("${release_dirs[@]:0:$keep_count}")
if [[ -n "$current_target" ]]; then
  keep_dirs+=("$current_target")
fi

for dir in "${release_dirs[@]}"; do
  should_keep=0
  for keep_dir in "${keep_dirs[@]}"; do
    if [[ "$dir" == "$keep_dir" ]]; then
      should_keep=1
      break
    fi
  done

  if [[ "$should_keep" -eq 1 ]]; then
    continue
  fi

  echo "Pruning old release: $dir"
  rm -rf "$dir"
done
