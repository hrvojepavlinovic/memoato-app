# Secrets rotation checklist

If a secret is ever exposed (or you suspect it was), rotate it immediately.

## Rotate

- `JWT_SECRET` (server): invalidates existing sessions/tokens.
- SMTP credentials:
  - `SMTP_PASSWORD`
  - `SMTP_USERNAME` (if applicable)
- Cloudflare Tunnel credentials file (if used): rotate the tunnel token/credentials.
- Any third-party keys used for integrations (analytics, LLMs, etc).

## Verify

- Signup/login still works.
- Email verification + password reset emails still send.
- App/API still reachable behind the tunnel.

