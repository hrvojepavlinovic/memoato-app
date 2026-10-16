import fs from "node:fs";
import { spawnSync } from "node:child_process";

// Wasp 0.20.2 validates this exact range before generating its projects.
// Its generated dependencies are patched and clean-installed afterwards;
// the compiler's temporary dependency tree must never be published.
const manifestPath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const originalManifest = fs.readFileSync(manifestPath);
const reviewedLock = fs.readFileSync(lockPath);
const compilerManifest = JSON.parse(originalManifest.toString());
compilerManifest.dependencies["react-router-dom"] = "^6.26.2";

let status = 1;
try {
  fs.writeFileSync(manifestPath, JSON.stringify(compilerManifest, null, 2) + "\n");
  const result = spawnSync("npx", ["--yes", "@wasp.sh/wasp-cli@0.20.2", "build"], {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development", NPM_CONFIG_INCLUDE: "dev" },
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  fs.writeFileSync(manifestPath, originalManifest);
  fs.writeFileSync(lockPath, reviewedLock);
}

process.exitCode = status;
