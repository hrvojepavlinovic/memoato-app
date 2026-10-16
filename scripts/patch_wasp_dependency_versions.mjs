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
    nodemailer: "^10.1.2",
    "react-router-dom": "^7.18.4",
    vitest: "^4.1.12",
    "@vitest/ui": "^4.1.12",
    msw: "^2.15.0",
  };
});

updatePackage(".wasp/build/server/package.json", (pkg) => {
  pkg.dependencies = {
    ...pkg.dependencies,
    morgan: "^1.12.1",
    nodemailer: "^10.1.2",
  };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    nodemon: "^3.1.14",
  };
});

updatePackage(".wasp/build/web-app/package.json", (pkg) => {
  pkg.dependencies = { ...pkg.dependencies, "react-router-dom": "^7.18.4" };
});

console.log("[patch_wasp_dependency_versions] Generated dependencies pinned to patched releases.");
