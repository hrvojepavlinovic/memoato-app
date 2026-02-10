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
  const email = emailFromUser || emailFromEmailIdentity || null;

  const emailProviderData = parseProviderData(emailIdentity?.providerData ?? "{}");
  const isEmailVerified = emailIdentity ? emailProviderData.isEmailVerified === true : true;

  const hasEmailAuth = !!emailIdentity;
  const hasGoogleAuth = !!googleIdentity;
  const needsEmailVerification = hasEmailAuth && !isEmailVerified;

  return {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    nextUpEnabled: user.nextUpEnabled,
    themePreference:
      user.themePreference === "dark" ? "dark" : user.themePreference === "light" ? "light" : null,
    email: email && email.includes("@") ? email : null,
    isEmailVerified,
    hasEmailAuth,
    hasGoogleAuth,
    needsEmailVerification,
  };
};
