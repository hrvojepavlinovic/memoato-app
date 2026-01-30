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

  const user = await context.entities.User.findUnique({
    where: { id: context.user.id },
    select: { username: true, firstName: true, lastName: true },
  });
  if (!user) {
    throw new HttpError(404);
  }

  const auth = await prisma.auth.findFirst({
    where: { userId: context.user.id },
    select: {
      identities: {
        where: { providerName: "email" },
        select: { providerUserId: true, providerData: true },
        take: 1,
      },
    },
  });

  const identity = auth?.identities?.[0] ?? null;
  const email = identity?.providerUserId?.trim().toLowerCase() ?? null;
  const providerData = parseProviderData(identity?.providerData ?? "{}");
  const isEmailVerified = providerData.isEmailVerified === true;

  return {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: email && email.includes("@") ? email : null,
    isEmailVerified,
  };
};
