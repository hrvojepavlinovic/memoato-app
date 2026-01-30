#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const target = path.join(repoRoot, ".wasp/build/server/src/auth/providers/email/verifyEmail.ts");

if (!fs.existsSync(target)) {
  console.error(`[patch_wasp_verify_email_autologin] Missing target: ${target}`);
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");

if (src.includes("/* memoato:verify-email-autologin */")) {
  process.exit(0);
}

if (!src.includes("export async function verifyEmail")) {
  console.error("[patch_wasp_verify_email_autologin] Unexpected file format (missing verifyEmail export).");
  process.exit(1);
}

// Ensure createSession import exists.
if (!src.includes("from 'wasp/auth/session'")) {
  src = src.replace(
    "import { HttpError } from 'wasp/server';",
    "import { HttpError } from 'wasp/server';\nimport { createSession } from 'wasp/auth/session';",
  );
}

// Replace the final res.json with creating a session and returning sessionId.
const resJsonNeedle = "res.json({ success: true });";
if (!src.includes(resJsonNeedle)) {
  console.error("[patch_wasp_verify_email_autologin] Unexpected file format (missing success response).");
  process.exit(1);
}

src = src.replace(
  resJsonNeedle,
  `/* memoato:verify-email-autologin */\n    const session = await createSession(auth.id);\n\n    res.json({ success: true, sessionId: session.id });`,
);

fs.writeFileSync(target, src, "utf8");
process.stderr.write("[patch_wasp_verify_email_autologin] Patched verify-email to return sessionId.\\n");

