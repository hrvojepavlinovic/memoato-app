import { createJWT, TimeSpan, validateJWT } from "wasp/auth/jwt";
import { ensureValidEmail, throwValidationError } from "wasp/auth/validation";
import { HttpError, prisma } from "wasp/server";
import { emailSender } from "wasp/server/email";
import { config as waspServerConfig } from "wasp/server";
import { randomBytes } from "node:crypto";
import type {
  ConfirmAccountDeletion,
  ConfirmEmailChange,
  RequestAccountDeletion,
  RequestEmailChange,
  SendPasswordResetForCurrentUser,
  SetActiveKcalRollupMode,
  SetHomeCategoryLayout,
  SetNextUpEnabled,
  RotatePublicStatsToken,
  SetQuickLogFabSide,
  SetPublicStatsCategories,
  SetPublicStatsEnabled,
  SetThemePreference,
  UpdateProfile,
} from "wasp/server/operations";
import { createPasswordResetLink, sendPasswordResetEmail } from "wasp/server/auth/email/utils";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function requireAuth(context: any): { userId: string } {
  if (!context.user) throw new HttpError(401);
  return { userId: context.user.id };
}

function getFromField() {
  return { name: "Memoato", email: "login@memoato.com" };
}

function formatEmailHtml({
  title,
  actionUrl,
  actionLabel,
  note,
}: {
  title: string;
  actionUrl: string;
  actionLabel: string;
  note?: string;
}): string {
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.4;">
    <h2 style="margin: 0 0 12px;">${title}</h2>
    <p style="margin: 0 0 16px;">
      <a href="${actionUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-weight: 700;">
        ${actionLabel}
      </a>
    </p>
    <p style="margin: 0; color: #525252; font-size: 14px;">
      ${note ?? "If you didn’t request this, you can ignore this email."}
    </p>
  </div>
  `.trim();
}

async function getEmailIdentity(userId: string) {
  const auth = await prisma.auth.findFirst({
    where: { userId },
    select: {
      id: true,
      identities: {
        where: { providerName: "email" },
        select: { providerName: true, providerUserId: true, providerData: true, authId: true },
        take: 1,
      },
    },
  });
  const identity = auth?.identities?.[0] ?? null;
  if (!identity) return null;
  return {
    providerName: identity.providerName,
    providerUserId: identity.providerUserId,
    providerData: identity.providerData,
    authId: identity.authId,
  };
}

function parseProviderData(providerData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(providerData);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function generatePublicToken(): string {
  // 32 bytes => 43 chars base64url.
  return randomBytes(32).toString("base64url");
}

async function updateUserWithFreshPublicToken(args: {
  userId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  let lastErr: any = null;
  for (let i = 0; i < 5; i += 1) {
    const token = generatePublicToken();
    try {
      await prisma.user.update({
        where: { id: args.userId },
        data: { ...args.data, publicStatsToken: token } as any,
      });
      return;
    } catch (e: any) {
      lastErr = e;
      if (e?.code !== "P2002") throw e;
    }
  }
  throw lastErr ?? new HttpError(500, "Failed to generate public token.");
}

function normalizeCategoryIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (!v) continue;
    out.push(v);
  }
  return Array.from(new Set(out)).slice(0, 25);
}

async function pickDefaultPublicStatsCategoryIds(userId: string): Promise<string[]> {
  const categories = await prisma.category.findMany({
    where: { userId, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true },
  });
  const byKey = new Map<string, string>();
  for (const c of categories) {
    const slugKey = (c.slug ?? "").trim().toLowerCase();
    if (slugKey) byKey.set(slugKey, c.id);
    const titleKey = c.title.trim().toLowerCase();
    if (titleKey) byKey.set(titleKey, c.id);
  }

  const preferred: string[] = [];
  const wantKeys = [
    "weight",
    "push-ups",
    "push ups",
    "pull-ups",
    "pull ups",
    "active-kcal",
    "active kcal",
    "indoor-cycling",
    "indoor cycling",
    "steps",
    "water-intake",
    "water intake",
    "water",
  ];
  for (const key of wantKeys) {
    const id = byKey.get(key);
    if (id && !preferred.includes(id)) preferred.push(id);
  }

  // Fall back to the first few categories if none matched.
  if (preferred.length === 0) {
    return categories.slice(0, 5).map((c) => c.id);
  }
  return preferred.slice(0, 10);
}

async function ensureEmailNotTaken(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    throw new HttpError(400, "That email is already in use.");
  }

  const existing = await prisma.authIdentity.findUnique({
    where: { providerName_providerUserId: { providerName: "email", providerUserId: email } },
    select: { authId: true },
  });
  if (existing) {
    throw new HttpError(400, "That email is already in use.");
  }
}

async function getUserPrimaryEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const emailFromUser = user?.email ? normalizeEmail(user.email) : null;
  if (emailFromUser && emailFromUser.includes("@")) return emailFromUser;

  const identity = await getEmailIdentity(userId);
  const emailFromIdentity = identity?.providerUserId ? normalizeEmail(identity.providerUserId) : null;
  return emailFromIdentity && emailFromIdentity.includes("@") ? emailFromIdentity : null;
}

export const updateProfile: UpdateProfile<
  { username: string; firstName?: string | null; lastName?: string | null },
  { success: true }
> = async (args, context) => {
  const { userId } = requireAuth(context);

  const username = String(args.username ?? "").trim();
  if (username.length < 6) {
    throwValidationError("Username must be at least 6 characters long.");
  }

  const firstName = args.firstName == null ? null : String(args.firstName).trim() || null;
  const lastName = args.lastName == null ? null : String(args.lastName).trim() || null;

  try {
    await context.entities.User.update({
      where: { id: userId },
      data: { username, firstName, lastName },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      throw new HttpError(400, "That username is already taken.");
    }
    throw e;
  }

  return { success: true };
};

export const setNextUpEnabled: SetNextUpEnabled<{ enabled: boolean }, { success: true }> = async (args, context) => {
  const { userId } = requireAuth(context);
  await context.entities.User.update({
    where: { id: userId },
    data: { nextUpEnabled: args.enabled === true },
  });
  return { success: true };
};

export const setThemePreference: SetThemePreference<{ preference: "light" | "dark" }, { success: true }> = async (
  args,
  context,
) => {
  const { userId } = requireAuth(context);
  const pref = args.preference === "dark" ? "dark" : "light";
  await context.entities.User.update({
    where: { id: userId },
    data: { themePreference: pref },
  });
  return { success: true };
};

export const setQuickLogFabSide: SetQuickLogFabSide<{ side: "left" | "right" }, { success: true }> = async (
  args,
  context,
) => {
  const { userId } = requireAuth(context);
  const side = args.side === "left" ? "left" : "right";
  await context.entities.User.update({
    where: { id: userId },
    data: { quickLogFabSide: side },
  });
  return { success: true };
};

export const setHomeCategoryLayout: SetHomeCategoryLayout<{ layout: "list" | "grid" }, { success: true }> = async (
  args,
  context,
) => {
  const { userId } = requireAuth(context);
  const layout = args.layout === "grid" ? "grid" : "list";
  await context.entities.User.update({
    where: { id: userId },
    data: { homeCategoryLayout: layout },
  });
  return { success: true };
};

export const setActiveKcalRollupMode: SetActiveKcalRollupMode<
  { mode: "auto" | "on" | "off" },
  { success: true }
> = async (args, context) => {
  const { userId } = requireAuth(context);
  const mode = args.mode === "on" || args.mode === "off" ? args.mode : "auto";
  await context.entities.User.update({
    where: { id: userId },
    data: { activeKcalRollupEnabled: mode === "auto" ? null : mode === "on" },
  });
  return { success: true };
};

export const setPublicStatsEnabled: SetPublicStatsEnabled<{ enabled: boolean }, { success: true }> = async (
  args,
  context,
) => {
  const { userId } = requireAuth(context);
  const enabled = args.enabled === true;

  if (!enabled) {
    await context.entities.User.update({
      where: { id: userId },
      data: { publicStatsEnabled: false, publicStatsToken: null },
    });
    return { success: true };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicStatsToken: true, publicStatsCategoryIds: true },
  });

  const currentCategoryIds = normalizeCategoryIds(existing?.publicStatsCategoryIds);
  const nextCategoryIds =
    currentCategoryIds.length > 0 ? currentCategoryIds : await pickDefaultPublicStatsCategoryIds(userId);

  const token =
    typeof existing?.publicStatsToken === "string" && existing.publicStatsToken.trim()
      ? existing.publicStatsToken
      : null;

  if (token) {
    await context.entities.User.update({
      where: { id: userId },
      data: { publicStatsEnabled: true, publicStatsToken: token, publicStatsCategoryIds: nextCategoryIds as any },
    });
  } else {
    await updateUserWithFreshPublicToken({
      userId,
      data: { publicStatsEnabled: true, publicStatsCategoryIds: nextCategoryIds as any },
    });
  }

  return { success: true };
};

export const rotatePublicStatsToken: RotatePublicStatsToken<void, { success: true }> = async (_args, context) => {
  const { userId } = requireAuth(context);
  await updateUserWithFreshPublicToken({ userId, data: { publicStatsEnabled: true } });
  return { success: true };
};

export const setPublicStatsCategories: SetPublicStatsCategories<{ categoryIds: string[] }, { success: true }> = async (
  args,
  context,
) => {
  const { userId } = requireAuth(context);
  const categoryIds = normalizeCategoryIds(args.categoryIds);
  if (categoryIds.length === 0) {
    await context.entities.User.update({
      where: { id: userId },
      data: { publicStatsCategoryIds: [] as any },
    });
    return { success: true };
  }

  const owned = await prisma.category.findMany({
    where: { userId, sourceArchivedAt: null, id: { in: categoryIds } },
    select: { id: true },
  });
  const ownedIds = owned.map((c) => c.id);

  await context.entities.User.update({
    where: { id: userId },
    data: { publicStatsCategoryIds: ownedIds as any },
  });
  return { success: true };
};

export const requestEmailChange: RequestEmailChange<{ newEmail: string }, { success: true }> =
  async (args, context) => {
    const { userId } = requireAuth(context);

    ensureValidEmail({ email: args.newEmail });
    const newEmail = normalizeEmail(args.newEmail);

    const identity = await getEmailIdentity(userId);
    if (!identity) {
      throw new HttpError(400, "Email change is only available for email login.");
    }
    const currentEmail = identity?.providerUserId ? normalizeEmail(identity.providerUserId) : null;
    if (currentEmail && currentEmail === newEmail) {
      return { success: true };
    }

    await ensureEmailNotTaken(newEmail);

    const jwtToken = await createJWT(
      { sub: "memoato-email-change", userId, newEmail },
      { expiresIn: new TimeSpan(30, "m") },
    );

    const confirmUrl = `${waspServerConfig.frontendUrl}/profile/email-change?token=${jwtToken}`;

    await emailSender.send({
      from: getFromField(),
      to: newEmail,
      subject: "Confirm your new Memoato email",
      html: formatEmailHtml({
        title: "Confirm email change",
        actionUrl: confirmUrl,
        actionLabel: "Confirm new email",
      }),
      text: `Confirm your new email: ${confirmUrl}`,
    });

    return { success: true };
  };

export const confirmEmailChange: ConfirmEmailChange<{ token: string }, { success: true }> = async (
  args,
  _context,
) => {
  const token = String(args.token ?? "");
  if (!token) throw new HttpError(400);

  const payload = await validateJWT<{ sub?: string; userId: string; newEmail: string }>(token).catch(
    () => {
      throw new HttpError(400, "Invalid or expired token.");
    },
  );

  if (payload.sub !== "memoato-email-change") {
    throw new HttpError(400, "Invalid token.");
  }

  const userId = payload.userId;
  const newEmail = normalizeEmail(payload.newEmail);

  ensureValidEmail({ email: newEmail });

  const identity = await getEmailIdentity(userId);
  if (!identity) throw new HttpError(404);

  if (normalizeEmail(identity.providerUserId) === newEmail) {
    return { success: true };
  }

  await ensureEmailNotTaken(newEmail);

  const providerData = parseProviderData(identity.providerData ?? "{}");
  providerData.isEmailVerified = true;
  providerData.emailVerificationSentAt = null;

  try {
    await prisma.$transaction([
      prisma.authIdentity.update({
        where: {
          providerName_providerUserId: {
            providerName: "email",
            providerUserId: identity.providerUserId,
          },
        },
        data: {
          providerUserId: newEmail,
          providerData: JSON.stringify(providerData),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { email: newEmail },
      }),
    ]);
  } catch (e: any) {
    if (e?.code === "P2002") {
      throw new HttpError(400, "That email is already in use.");
    }
    throw e;
  }

  return { success: true };
};

export const sendPasswordResetForCurrentUser: SendPasswordResetForCurrentUser<
  void,
  { success: true }
> = async (_args, context) => {
  const { userId } = requireAuth(context);
  const identity = await getEmailIdentity(userId);
  if (!identity) {
    throw new HttpError(400, "Password reset is only available for email login.");
  }
  const email = identity?.providerUserId ? normalizeEmail(identity.providerUserId) : null;
  if (!email) throw new HttpError(400);

  const passwordResetLink = await createPasswordResetLink(email, "/password-reset");
  await sendPasswordResetEmail(email, {
    from: getFromField(),
    to: email,
    subject: "Reset your Memoato password",
    html: formatEmailHtml({
      title: "Reset your password",
      actionUrl: passwordResetLink,
      actionLabel: "Reset password",
    }),
    text: `Reset your password: ${passwordResetLink}`,
  });

  return { success: true };
};

export const requestAccountDeletion: RequestAccountDeletion<void, { success: true }> = async (
  _args,
  context,
) => {
  const { userId } = requireAuth(context);
  const email = await getUserPrimaryEmail(userId);
  if (!email) throw new HttpError(400);

  const jwtToken = await createJWT(
    { sub: "memoato-delete-account", userId },
    { expiresIn: new TimeSpan(30, "m") },
  );

  const confirmUrl = `${waspServerConfig.frontendUrl}/profile/delete-account?token=${jwtToken}`;

  await emailSender.send({
    from: getFromField(),
    to: email,
    subject: "Confirm Memoato account deletion",
    html: formatEmailHtml({
      title: "Confirm account deletion",
      actionUrl: confirmUrl,
      actionLabel: "Delete account",
      note: "This will permanently delete your Memoato data.",
    }),
    text: `Delete your account: ${confirmUrl}`,
  });

  return { success: true };
};

export const confirmAccountDeletion: ConfirmAccountDeletion<{ token: string }, { success: true }> =
  async (args, _context) => {
    const token = String(args.token ?? "");
    if (!token) throw new HttpError(400);

    const payload = await validateJWT<{ sub?: string; userId: string }>(token).catch(() => {
      throw new HttpError(400, "Invalid or expired token.");
    });
    if (payload.sub !== "memoato-delete-account") {
      throw new HttpError(400, "Invalid token.");
    }

    const userId = payload.userId;

    await prisma.$transaction([
      prisma.event.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
      prisma.user.deleteMany({ where: { id: userId } }),
    ]);

    return { success: true };
  };
