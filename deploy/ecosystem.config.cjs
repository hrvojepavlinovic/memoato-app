const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const releaseDir = process.env.MEMOATO_RELEASE_DIR || path.join(repoRoot, "deploy/current");
const dotenvPath = process.env.DOTENV_CONFIG_PATH || path.join(repoRoot, ".env.server");

module.exports = {
  apps: [
    // Note: we intentionally do not run cloudflared from this repo.
    // The memoato.com landing uses Cloudflare Pages, while app/api are served
    // via an externally managed Cloudflare Tunnel (HP/HP-dev).
    {
      name: "memoato-api",
      cwd: repoRoot,
      script: "bash",
      args: "scripts/run_api_prod.sh",
      env: {
        DOTENV_CONFIG_PATH: dotenvPath,
        MEMOATO_RELEASE_DIR: releaseDir,
      },
      kill_timeout: 5000,
    },
    {
      name: "memoato-web",
      cwd: repoRoot,
      script: "bash",
      args: "scripts/run_web_prod.sh",
      env: {
        WEB_PORT: "5050",
        MEMOATO_RELEASE_DIR: releaseDir,
      },
      kill_timeout: 5000,
    },
  ],
};
