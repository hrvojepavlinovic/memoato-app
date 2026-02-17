import fs from "node:fs";
import path from "node:path";

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) return { patched: false, reason: "missing" };
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;
  const missing = [];
  for (const { name, from, to } of patches) {
    if (!next.includes(from)) {
      missing.push(name);
      continue;
    }
    next = next.replace(from, to);
  }
  if (next === original) {
    return { patched: false, reason: missing.length > 0 ? `pattern-not-found:${missing.join(",")}` : "no-change" };
  }
  fs.writeFileSync(filePath, next, "utf8");
  return { patched: true, reason: missing.length > 0 ? `pattern-not-found:${missing.join(",")}` : "ok" };
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

const elseBranchStart =
  "  } else {\n" +
  "    const userFields = await validateAndGetUserFields(\n" +
  "      { profile: providerProfile },\n" +
  "      userSignupFields,\n" +
  "    )\n";

const linkExistingByEmailBlock =
  "  } else {\n" +
  "    try {\n" +
  "      const raw = typeof providerProfile?.email === 'string' ? providerProfile.email : null\n" +
  "      const email = raw ? String(raw).trim().toLowerCase() : null\n" +
  "      if (email && email.includes('@')) {\n" +
  "        const existingUser = await prisma.user.findUnique({\n" +
  "          where: { email },\n" +
  "          include: { auth: true },\n" +
  "        })\n" +
  "        if (existingUser) {\n" +
  "          const authForUser =\n" +
  "            existingUser.auth ??\n" +
  "            (await prisma.auth.create({ data: { user: { connect: { id: existingUser.id } } } }))\n" +
  "          const providerData = await sanitizeAndSerializeProviderData({})\n" +
  "          try {\n" +
  "            await prisma.authIdentity.create({\n" +
  "              data: {\n" +
  "                providerName: providerId.providerName,\n" +
  "                providerUserId: providerId.providerUserId,\n" +
  "                providerData,\n" +
  "                authId: authForUser.id,\n" +
  "              },\n" +
  "            })\n" +
  "          } catch (e) {\n" +
  "            console.error('Failed to link OAuth identity:', e)\n" +
  "          }\n" +
  "          try {\n" +
  "            await prisma.user.update({\n" +
  "              where: { id: existingUser.id },\n" +
  "              data: {\n" +
  "                email,\n" +
  "                firstName: existingUser.firstName ?? (typeof providerProfile?.given_name === 'string' ? providerProfile.given_name : null),\n" +
  "                lastName: existingUser.lastName ?? (typeof providerProfile?.family_name === 'string' ? providerProfile.family_name : null),\n" +
  "              },\n" +
  "            })\n" +
  "          } catch (e) {\n" +
  "            console.error('Failed to sync OAuth profile fields:', e)\n" +
  "          }\n" +
  "          await onBeforeLoginHook({\n" +
  "            req,\n" +
  "            providerId,\n" +
  "            user: existingUser,\n" +
  "          })\n" +
  "          await onAfterLoginHook({\n" +
  "            req,\n" +
  "            providerId,\n" +
  "            oauth,\n" +
  "            user: existingUser,\n" +
  "          })\n" +
  "          return authForUser.id\n" +
  "        }\n" +
  "      }\n" +
  "    } catch (e) {\n" +
  "      console.error('Failed to link OAuth account by email:', e)\n" +
  "    }\n+\n" +
  "    const userFields = await validateAndGetUserFields(\n" +
  "      { profile: providerProfile },\n" +
  "      userSignupFields,\n" +
  "    )\n";

const createUserCall =
  "    const user = await createUser(\n" +
  "      providerId,\n" +
  "      providerData,\n" +
  "      // Using any here because we want to avoid TypeScript errors and\n" +
  "      // rely on Prisma to validate the data.\n" +
  "      userFields as any,\n" +
  "    )\n";

const syncAfterCreateUserCall =
  createUserCall +
  "    try {\n" +
  "      const raw = typeof providerProfile?.email === 'string' ? providerProfile.email : null\n" +
  "      const email = raw ? String(raw).trim().toLowerCase() : null\n" +
  "      if (email && email.includes('@')) {\n" +
  "        await prisma.user.update({\n" +
  "          where: { id: user.id },\n" +
  "          data: {\n" +
  "            email,\n" +
  "            firstName: user.firstName ?? (typeof providerProfile?.given_name === 'string' ? providerProfile.given_name : null),\n" +
  "            lastName: user.lastName ?? (typeof providerProfile?.family_name === 'string' ? providerProfile.family_name : null),\n" +
  "          },\n" +
  "        })\n" +
  "      }\n" +
  "    } catch (e) {\n" +
  "      console.error('Failed to sync OAuth profile fields:', e)\n" +
  "    }\n";

const result = patchFile(userPath, [
  {
    name: "sync-oauth-profile-fields",
    from: insertAfterAuthFetch,
    to: syncBlock,
  },
  {
    name: "link-existing-oauth-by-email",
    from: elseBranchStart,
    to: linkExistingByEmailBlock,
  },
  {
    name: "sync-oauth-profile-fields-on-signup",
    from: createUserCall,
    to: syncAfterCreateUserCall,
  },
]);

if (result.patched) {
  console.log("[patch_wasp_oauth_profile_sync] OAuth linking and profile sync patched.");
} else {
  console.log(`[patch_wasp_oauth_profile_sync] Not patched (${result.reason}).`);
}
