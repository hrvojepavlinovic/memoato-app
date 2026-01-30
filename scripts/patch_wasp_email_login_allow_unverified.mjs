import fs from "node:fs/promises";

async function patchFile(path) {
  let src;
  try {
    src = await fs.readFile(path, "utf8");
  } catch {
    return false;
  }

  const lines = src.split(/\r?\n/);
  const out = [];

  let skipping = false;
  for (const line of lines) {
    if (!skipping && line.includes("if (!providerData.isEmailVerified)")) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (line.trim() === "}") {
        skipping = false;
      }
      continue;
    }
    out.push(line);
  }

  const next = out.join("\n");

  if (next === src) {
    return false;
  }

  await fs.writeFile(path, next, "utf8");
  return true;
}

const targets = [
  ".wasp/build/server/src/auth/providers/email/login.ts",
  ".wasp/build/server/dist/src/auth/providers/email/login.js",
];

const results = await Promise.all(targets.map(patchFile));
if (!results.some(Boolean)) {
  console.warn("[patch_wasp_email_login_allow_unverified] No changes applied (files not found or already patched).");
} else {
  console.log("[patch_wasp_email_login_allow_unverified] Patched email login to allow unverified accounts.");
}
