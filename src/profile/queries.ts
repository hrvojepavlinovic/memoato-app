import { prisma } from "wasp/server";
import { HttpError } from "wasp/server";
import type { GetProfile } from "wasp/server/operations";
import type { ProfileData } from "./types";

function parseProviderData(providerData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(providerData);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function extractEmailFromProviderData(providerData: string): string | null {
  const data = parseProviderData(providerData);
  const profile = (data as any)?.profile;
  if (typeof profile?.email === "string" && profile.email.trim()) return profile.email.trim().toLowerCase();
  if (Array.isArray(profile?.emails) && typeof profile.emails?.[0]?.value === "string") {
    const v = profile.emails[0].value.trim().toLowerCase();
    return v && v.includes("@") ? v : null;
  }
  if (typeof (data as any)?.email === "string") {
    const v = String((data as any).email).trim().toLowerCase();
    return v && v.includes("@") ? v : null;
  }
  return null;
}

export const getProfile: GetProfile<void, ProfileData> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: {
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      nextUpEnabled: true,
      themePreference: true,
      quickLogFabSide: true,
      homeCategoryLayout: true,
      activeKcalRollupEnabled: true,
      publicStatsEnabled: true,
      publicStatsToken: true,
      publicStatsCategoryIds: true,
    },
  });
  if (!user) {
    throw new HttpError(404);
  }

  const auth = await prisma.auth.findFirst({
    where: { userId: context.user.id },
    select: {
      identities: {
        where: { providerName: { in: ["email", "google"] } },
        select: { providerName: true, providerUserId: true, providerData: true },
      },
    },
  });

  const identities = auth?.identities ?? [];
  const emailIdentity = identities.find((i) => i.providerName === "email") ?? null;
  const googleIdentity = identities.find((i) => i.providerName === "google") ?? null;

  const emailFromUser = user.email?.trim().toLowerCase() ?? null;
  const emailFromEmailIdentity = emailIdentity?.providerUserId?.trim().toLowerCase() ?? null;
  const emailFromGoogleIdentity = googleIdentity ? extractEmailFromProviderData(googleIdentity.providerData ?? "{}") : null;
  const email = emailFromUser || emailFromEmailIdentity || emailFromGoogleIdentity || null;

  const emailProviderData = parseProviderData(emailIdentity?.providerData ?? "{}");
  const isEmailVerified = emailIdentity ? emailProviderData.isEmailVerified === true : true;

  const hasEmailAuth = !!emailIdentity;
  const hasGoogleAuth = !!googleIdentity;
  const needsEmailVerification = hasEmailAuth && !isEmailVerified;

  const publicStatsCategoryIdsRaw = user.publicStatsCategoryIds;
  const publicStatsCategoryIds =
    Array.isArray(publicStatsCategoryIdsRaw) && publicStatsCategoryIdsRaw.every((x) => typeof x === "string")
      ? (publicStatsCategoryIdsRaw as string[])
      : [];

  return {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    nextUpEnabled: user.nextUpEnabled,
    themePreference:
      user.themePreference === "dark" ? "dark" : user.themePreference === "light" ? "light" : null,
    quickLogFabSide: user.quickLogFabSide === "left" ? "left" : "right",
    homeCategoryLayout: user.homeCategoryLayout === "grid" ? "grid" : "list",
    activeKcalRollupEnabled: user.activeKcalRollupEnabled == null ? null : user.activeKcalRollupEnabled === true,
    publicStatsEnabled: user.publicStatsEnabled === true,
    publicStatsToken: typeof user.publicStatsToken === "string" && user.publicStatsToken.trim() ? user.publicStatsToken : null,
    publicStatsCategoryIds,
    email: email && email.includes("@") ? email : null,
    isEmailVerified,
    hasEmailAuth,
    hasGoogleAuth,
    needsEmailVerification,
  };
};
