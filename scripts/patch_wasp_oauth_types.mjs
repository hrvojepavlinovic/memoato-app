import fs from "node:fs";
import path from "node:path";

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) return { patched: false, reason: "missing" };
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;
  for (const { name, from, to } of patches) {
    if (!next.includes(from)) {
      return { patched: false, reason: `pattern-not-found:${name}` };
    }
    next = next.replace(from, to);
  }
  if (next === original) return { patched: false, reason: "no-change" };
  fs.writeFileSync(filePath, next, "utf8");
  return { patched: true };
}

const repoRoot = process.cwd();
const oauthDir = path.join(repoRoot, ".wasp", "build", "server", "src", "auth", "providers", "oauth");

const handlerPath = path.join(oauthDir, "handler.ts");
const oneTimeCodePath = path.join(oauthDir, "oneTimeCode.ts");

const handlerResult = patchFile(handlerPath, [
  {
    name: "onBeforeOAuthRedirectHook-req",
    from: "      const { url: redirectUrlAfterHook } = await onBeforeOAuthRedirectHook({\n        req,\n",
    to: "      const { url: redirectUrlAfterHook } = await onBeforeOAuthRedirectHook({\n        req: req as any,\n",
  },
  {
    name: "finishOAuthFlow-req",
    from: "            userSignupFields,\n            req,\n            oauth: {\n",
    to: "            userSignupFields,\n            req: req as any,\n            oauth: {\n",
  },
]);

const oneTimeCodeResult = patchFile(oneTimeCodePath, [
  {
    name: "req-body-cast",
    from: "      const { code } = req.body;\n",
    to: "      const { code } = ((req.body as any) ?? {}) as any;\n",
  },
  {
    name: "res-json-cast",
    from: "      res.json({\n        sessionId: session.id,\n      });\n",
    to: "      res.json({ sessionId: session.id } as any);\n",
  },
]);

if (handlerResult.patched) {
  console.log("[patch_wasp_oauth_types] Patched OAuth handler request typing.");
} else {
  console.log(`[patch_wasp_oauth_types] OAuth handler not patched (${handlerResult.reason}).`);
}

if (oneTimeCodeResult.patched) {
  console.log("[patch_wasp_oauth_types] Patched OAuth one-time-code route typing.");
} else {
  console.log(`[patch_wasp_oauth_types] OAuth one-time-code route not patched (${oneTimeCodeResult.reason}).`);
}

