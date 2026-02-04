# Codex handover (how to run + notify)

This repo is designed to be worked on with Codex CLI. Notifications are handled outside the repo via a small helper script:

- `~/.local/bin/send-telegram-message`
- Config: `~/.config/codex-telegram.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)

## Quick start (full permissions, no approvals)

Run Codex with bypassed approvals + no sandbox (use only on your own machine):

```bash
codex --dangerously-bypass-approvals-and-sandbox -C /home/harvey/git/memoato
```

Optional, recommended for terminal multiplexers (tmux/zellij) so you can scroll:

```bash
codex --dangerously-bypass-approvals-and-sandbox --no-alt-screen -C /home/harvey/git/memoato
```

## Telegram: send a message

```bash
send-telegram-message "Hello from Codex"
printf "Line 1\nLine 2\n" | send-telegram-message
```

If `TELEGRAM_CHAT_ID` is missing, the script tries to discover it via `getUpdates`. You must send `/start` (or any message) to the bot first.

## How Codex should use Telegram (policy)

During a session, send a Telegram message when:
- You’re about to ask the human something / wait for input.
- You’re starting or finishing a deploy/migration.
- You finished the requested work and want to hand off.

Keep messages short; don’t paste secrets.

## Workflow (commit → push → deploy)

This is an open-source repo: **every push is public**. Treat all diffs + commit messages as public and permanent.

After each completed change (feature/fix/docs), follow this flow:

1. Sanity check:
   - `git status`
   - run tests/linters relevant to the change (at minimum: `npm test`)
2. Commit:
   - keep commits small and focused
   - never commit secrets (`.env*`, tokens, credentials)
3. Push:
   - pushing triggers public CI/hosting; assume the world can see it
4. Deploy:
   - **Landing (Astro)** deploys on push to `main` via Cloudflare Pages (Connect to Git).
   - **App (Wasp)** deploys via `./scripts/deploy_prod.sh` (see `docs/DEPLOY.md`).
