#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${MEMOATO_MCP_REPO_URL:-https://github.com/hrvojepavlinovic/memoato-app.git}"
REPO_DIR="${MEMOATO_MCP_REPO_DIR:-${HOME}/.memoato/memoato-app}"
BIN_DIR="${MEMOATO_MCP_BIN_DIR:-${HOME}/.memoato/bin}"
BIN_PATH="${BIN_DIR}/memoato-mcp"

command -v git >/dev/null 2>&1 || {
  echo "git is required to install Memoato MCP." >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || {
  echo "npm is required to install Memoato MCP." >&2
  exit 1
}

mkdir -p "$(dirname "${REPO_DIR}")" "${BIN_DIR}"

if [ -d "${REPO_DIR}/.git" ]; then
  git -C "${REPO_DIR}" pull --ff-only
else
  git clone --depth 1 "${REPO_URL}" "${REPO_DIR}"
fi

cd "${REPO_DIR}/tools/memoato-mcp"
npm install
npm run build

cat >"${BIN_PATH}" <<EOF
#!/usr/bin/env bash
exec node "${REPO_DIR}/tools/memoato-mcp/dist/server.js"
EOF
chmod +x "${BIN_PATH}"

cat <<EOF

Memoato MCP installed.

Server command:
  ${BIN_PATH}

Next:
  1. Create a Memoato API key at https://app.memoato.com/profile
  2. Add this server command to Claude or Codex with MEMOATO_MCP_TOKEN set to that key.
EOF
