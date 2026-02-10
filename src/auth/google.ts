import { defineUserSignupFields } from "wasp/server/auth";
import { prisma } from "wasp/server";

function sanitizeUsernameBase(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (cleaned.length >= 6) return cleaned.slice(0, 24);

  const padded = `${cleaned || "user"}_${randomSuffix(6)}`;
  return padded.slice(0, 24);
}

function randomSuffix(len: number): string {
  const s = Math.random().toString(36).slice(2);
  if (s.length >= len) return s.slice(0, len);
  return (s + Math.random().toString(36).slice(2)).slice(0, len);
}

async function ensureUniqueUsername(base: string): Promise<string> {
  const baseSanitized = sanitizeUsernameBase(base);
  const exists = await prisma.user.findUnique({ where: { username: baseSanitized } });
  if (!exists) return baseSanitized;

  for (let i = 0; i < 12; i++) {
    const candidate = `${baseSanitized.slice(0, 18)}_${randomSuffix(5)}`.slice(0, 24);
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }

  throw new Error("Could not generate an available username.");
}

function extractEmail(data: Record<string, unknown>): string | null {
  const profile = (data as any)?.profile;
  if (typeof profile?.email === "string" && profile.email.trim()) return profile.email.trim();
  if (Array.isArray(profile?.emails) && typeof profile.emails?.[0]?.value === "string") {
    const v = profile.emails[0].value.trim();
    return v ? v : null;
  }
  return null;
}

function extractNamePart(data: Record<string, unknown>, key: "given_name" | "family_name"): string | null {
  const profile = (data as any)?.profile;
  const v = profile?.[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof profile?.name?.[key === "given_name" ? "givenName" : "familyName"] === "string") {
    const s = profile.name[key === "given_name" ? "givenName" : "familyName"].trim();
    return s ? s : null;
  }
  return null;
}

export const userSignupFields = defineUserSignupFields({
  username: async (data) => {
    const email = extractEmail(data as any);
    const localPart = email ? email.split("@")[0] : "user";
    return ensureUniqueUsername(localPart);
  },
  firstName: (data) => extractNamePart(data as any, "given_name") ?? undefined,
  lastName: (data) => extractNamePart(data as any, "family_name") ?? undefined,
});

export function getConfig() {
  return { scopes: ["profile", "email"] };
}
