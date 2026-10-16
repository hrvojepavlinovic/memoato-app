// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each([0, 42])("restores reviewed files when the compiler exits with %s", (exitCode) => {
  const fixture = mkdtempSync(path.join(tmpdir(), "memoato-compiler-"));
  try {
    mkdirSync(path.join(fixture, "scripts"));
    mkdirSync(path.join(fixture, "bin"));
    const manifest = JSON.stringify({ dependencies: { "react-router-dom": "^7.18.4" } });
    const lock = '{"reviewed":true}\n';
    writeFileSync(path.join(fixture, "package.json"), manifest);
    writeFileSync(path.join(fixture, "package-lock.json"), lock);
    writeFileSync(path.join(fixture, "scripts/compile_wasp.mjs"),
      readFileSync(new URL("../../scripts/compile_wasp.mjs", import.meta.url)));
    const fakeNpx = path.join(fixture, "bin/npx");
    writeFileSync(fakeNpx, `#!/usr/bin/env node
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (manifest.dependencies['react-router-dom'] !== '^6.26.2') process.exit(91);
if (!process.argv.includes('@wasp.sh/wasp-cli@0.20.2')) process.exit(92);
fs.writeFileSync('package-lock.json', 'compiler replaced this');
process.exit(${exitCode});
`);
    chmodSync(fakeNpx, 0o755);
    const result = spawnSync(process.execPath, [path.join(fixture, "scripts/compile_wasp.mjs")], {
      env: { ...process.env, PATH: path.join(fixture, "bin") + path.delimiter + process.env.PATH },
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(exitCode);
    expect(readFileSync(path.join(fixture, "package.json"), "utf8")).toBe(manifest);
    expect(readFileSync(path.join(fixture, "package-lock.json"), "utf8")).toBe(lock);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
