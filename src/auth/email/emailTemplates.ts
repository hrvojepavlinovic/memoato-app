import type {
  GetPasswordResetEmailContentFn,
  GetVerificationEmailContentFn,
} from "wasp/server/auth/email";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSimpleEmailHtml({
  title,
  intro,
  actionUrl,
  actionLabel,
  footer,
}: {
  title: string;
  intro: string;
  actionUrl: string;
  actionLabel: string;
  footer: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeFooter = escapeHtml(footer);
  const safeUrl = escapeHtml(actionUrl);

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #f5f5f5; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 14px; padding: 20px;">
      <div style="font-size: 14px; font-weight: 800; letter-spacing: -0.02em; color: #0a0a0a;">memoato</div>
      <h1 style="margin: 10px 0 0; font-size: 18px; font-weight: 800; color: #0a0a0a;">${safeTitle}</h1>
      <p style="margin: 10px 0 0; font-size: 14px; line-height: 1.45; color: #262626;">${safeIntro}</p>

      <div style="margin: 16px 0 0;">
        <a href="${safeUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; padding: 10px 14px; border-radius: 10px; text-decoration: none; font-weight: 700;">
          ${escapeHtml(actionLabel)}
        </a>
      </div>

      <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.45; color: #737373;">
        If the button doesn’t work, copy and paste this link:
        <br />
        <a href="${safeUrl}" style="color: #0a0a0a;">${safeUrl}</a>
      </p>

      <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 18px 0;" />
      <p style="margin: 0; font-size: 12px; color: #737373;">${safeFooter}</p>
    </div>
  </div>
  `.trim();
}

export const getVerificationEmailContent: GetVerificationEmailContentFn = ({ verificationLink }) => ({
  subject: "Confirm your Memoato email",
  text: `Welcome to memoato!\n\nConfirm your email to finish signing up:\n${verificationLink}\n\nIf you didn't create an account, you can ignore this email.`,
  html: formatSimpleEmailHtml({
    title: "Confirm your email",
    intro: "Welcome to memoato. Confirm your email to finish signing up.",
    actionUrl: verificationLink,
    actionLabel: "Confirm email",
    footer: "If you didn’t create an account, you can ignore this email.",
  }),
});

export const getPasswordResetEmailContent: GetPasswordResetEmailContentFn = ({ passwordResetLink }) => ({
  subject: "Reset your Memoato password",
  text: `Reset your memoato password:\n${passwordResetLink}\n\nIf you didn't request a password reset, you can ignore this email.`,
  html: formatSimpleEmailHtml({
    title: "Reset your password",
    intro: "You requested a password reset for your memoato account.",
    actionUrl: passwordResetLink,
    actionLabel: "Reset password",
    footer: "If you didn’t request this, you can ignore this email.",
  }),
});

