# Memoato agent instructions

These instructions apply to the whole repository.

## Telegram notifications (Codex hook)

If `send-telegram-message` is available (expected at `~/.local/bin/send-telegram-message`), use it to keep the human in the loop and minimize idle time.

Send a Telegram message in these situations:

1. **Before you block on human input** (questions, missing credentials, “what should I do?”, etc.).
2. **Before any action that would normally require approval** (destructive commands, escalations, production deploys).
3. **When a long-running task starts** (deploy, migrations, big builds), and once it finishes.
4. **When the task is complete** (1 short message with what changed and what’s next).

Message style:
- Keep it short and actionable (what you need, exactly).
- Don’t include secrets (tokens, passwords, `.env` contents).
- If you need to reference code, include file paths and line numbers (e.g. `src/foo.ts:42`).

Example:
- `send-telegram-message "Blocked: need Cloudflare API token for Pages deploy. Please paste CF_API_TOKEN (read+write Pages only)."`

## Repo hygiene

- Never commit secrets: anything under `.env*` (except `.example`) or credentials.
- Prefer small, focused patches and keep docs updated when behavior changes.

