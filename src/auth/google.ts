import { defineUserSignupFields } from "wasp/server/auth";
import { prisma } from "wasp/server";

function randomSuffix(len: number): string {
  const s = Math.random().toString(36).slice(2);
  if (s.length >= len) return s.slice(0, len);
  return (s + Math.random().toString(36).slice(2)).slice(0, len);
}

function makeUsernameCandidate(prefix: string): string {
  const cleanedPrefix = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  const base = cleanedPrefix || "user";
  return `${base}_${randomSuffix(6)}`.slice(0, 24);
}

async function generateUniqueUsername(prefix: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = makeUsernameCandidate(prefix);
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
  email: (data) => {
    const email = extractEmail(data as any);
    if (!email) {
      throw new Error("Email is required.");
    }
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      throw new Error("Email is required.");
    }
    return clean;
  },
  username: async (data) => {
    const email = extractEmail(data as any);
    const localPart = email ? email.split("@")[0] : "user";
    return generateUniqueUsername(localPart);
  },
  firstName: (data) => extractNamePart(data as any, "given_name") ?? undefined,
  lastName: (data) => extractNamePart(data as any, "family_name") ?? undefined,
});

export function getConfig() {
  return { scopes: ["profile", "email"] };
}
