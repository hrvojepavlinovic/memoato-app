#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const target = path.join(repoRoot, ".wasp/build/server/src/auth/providers/config/email.ts");

if (!fs.existsSync(target)) {
  console.error(`[patch_wasp_email_templates] Missing target: ${target}`);
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");

const alreadyPatched =
  src.includes("getVerificationEmailContent({ verificationLink })") &&
  src.includes("getPasswordResetEmailContent({ passwordResetLink })");
if (alreadyPatched) process.exit(0);

const importNeedle = "import { userSignupFields } from '../../../../../../../src/auth/email/userSignupFields'";
if (!src.includes(importNeedle)) {
  console.error("[patch_wasp_email_templates] Unexpected file format (missing userSignupFields import).");
  process.exit(1);
}

const importLine =
  "import { getVerificationEmailContent, getPasswordResetEmailContent } from '../../../../../../../src/auth/email/emailTemplates'";
if (!src.includes(importLine)) {
  src = src.replace(importNeedle, `${importNeedle}\n${importLine}`);
}

const blockStart = src.indexOf("const _waspGetVerificationEmailContent");
const blockEnd = src.indexOf("const fromField");
if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
  console.error("[patch_wasp_email_templates] Unexpected file format (could not locate template block).");
  process.exit(1);
}

const replacement = `
/* memoato:patched-email-templates */
const _waspGetVerificationEmailContent: GetVerificationEmailContentFn = ({ verificationLink }) =>
  getVerificationEmailContent({ verificationLink });
const _waspGetPasswordResetEmailContent: GetPasswordResetEmailContentFn = ({ passwordResetLink }) =>
  getPasswordResetEmailContent({ passwordResetLink });

`.trimStart();

src = src.slice(0, blockStart) + replacement + src.slice(blockEnd);

fs.writeFileSync(target, src, "utf8");
process.stderr.write("[patch_wasp_email_templates] Patched Wasp email templates.\\n");
