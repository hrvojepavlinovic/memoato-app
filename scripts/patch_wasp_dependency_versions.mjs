import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function updatePackage(relativePath, update) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Generated Wasp package is missing: ${relativePath}`);
  }
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));
  update(pkg);
  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

updatePackage(".wasp/out/sdk/wasp/package.json", (pkg) => {
  pkg.dependencies = {
    ...pkg.dependencies,
    nodemailer: "^9.0.3",
    vitest: "^4.1.10",
    "@vitest/ui": "^4.1.10",
    msw: "^2.15.0",
  };
});

updatePackage(".wasp/build/server/package.json", (pkg) => {
  pkg.dependencies = {
    ...pkg.dependencies,
    morgan: "^1.11.0",
    nodemailer: "^9.0.3",
  };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    nodemon: "^3.1.14",
  };
});

console.log("[patch_wasp_dependency_versions] Generated dependencies pinned to patched releases.");
