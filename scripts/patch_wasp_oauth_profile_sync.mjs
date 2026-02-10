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
const userPath = path.join(repoRoot, ".wasp", "build", "server", "src", "auth", "providers", "oauth", "user.ts");

const insertAfterAuthFetch =
  "    if (auth === null) {\n" +
  "        throw new Error('Auth entity not found while trying to log in with OAuth')\n" +
  "    }\n\n";

const syncBlock =
  insertAfterAuthFetch +
  "    try {\n" +
  "      const raw = typeof providerProfile?.email === 'string' ? providerProfile.email : null\n" +
  "      const email = raw ? String(raw).trim().toLowerCase() : null\n" +
  "      if (email && email.includes('@')) {\n" +
  "        await prisma.user.update({\n" +
  "          where: { id: auth.user.id },\n" +
  "          data: {\n" +
  "            email,\n" +
  "            firstName: auth.user.firstName ?? (typeof providerProfile?.given_name === 'string' ? providerProfile.given_name : null),\n" +
  "            lastName: auth.user.lastName ?? (typeof providerProfile?.family_name === 'string' ? providerProfile.family_name : null),\n" +
  "          },\n" +
  "        })\n" +
  "      }\n" +
  "    } catch (e) {\n" +
  "      console.error('Failed to sync OAuth profile fields:', e)\n" +
  "    }\n\n";

const result = patchFile(userPath, [
  {
    name: "sync-oauth-profile-fields",
    from: insertAfterAuthFetch,
    to: syncBlock,
  },
]);

if (result.patched) {
  console.log("[patch_wasp_oauth_profile_sync] Synced OAuth profile fields into User on login.");
} else {
  console.log(`[patch_wasp_oauth_profile_sync] Not patched (${result.reason}).`);
}

