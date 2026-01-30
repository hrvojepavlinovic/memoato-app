import { createJWT, TimeSpan, validateJWT } from "wasp/auth/jwt";
import { ensureValidEmail, throwValidationError } from "wasp/auth/validation";
import { HttpError, prisma } from "wasp/server";
import { emailSender } from "wasp/server/email";
import { config as waspServerConfig } from "wasp/server";
import type {
  ConfirmAccountDeletion,
  ConfirmEmailChange,
  RequestAccountDeletion,
  RequestEmailChange,
  SendPasswordResetForCurrentUser,
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

async function ensureEmailNotTaken(email: string) {
  const existing = await prisma.authIdentity.findUnique({
    where: { providerName_providerUserId: { providerName: "email", providerUserId: email } },
    select: { authId: true },
  });
  if (existing) {
    throw new HttpError(400, "That email is already in use.");
  }
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

export const requestEmailChange: RequestEmailChange<{ newEmail: string }, { success: true }> =
  async (args, context) => {
    const { userId } = requireAuth(context);

    ensureValidEmail({ email: args.newEmail });
    const newEmail = normalizeEmail(args.newEmail);

    const identity = await getEmailIdentity(userId);
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
    await prisma.authIdentity.update({
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
    });
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
  const identity = await getEmailIdentity(userId);
  const email = identity?.providerUserId ? normalizeEmail(identity.providerUserId) : null;
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
