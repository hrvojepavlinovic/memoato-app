# Notifications (Moshi)

Memoato can optionally send a push notification via Moshi after deploys.

This repo includes `scripts/moshi_notify.sh`, and `scripts/deploy_prod.sh` calls it at the end (non-blocking).

## Setup

- Add `MOSHI_WEBHOOK_TOKEN` to `.env.server` (this file is ignored by git).
- Optional: set `MOSHI_WEBHOOK_URL` (defaults to `https://api.getmoshi.app/api/webhook`).

Example:

```bash
MOSHI_WEBHOOK_TOKEN="..."
```

## Manual test

```bash
./scripts/moshi_notify.sh "Task Complete" "Your task finished!"
```

## Note (Codex CLI)

In this coding assistant environment, outbound network calls (like `curl`) may require explicit approval even if the script is present.

