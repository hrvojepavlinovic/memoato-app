# Notifications (Moshi)

Memoato can optionally send a push notification via Moshi after deploys.

This repo includes:

- `src/notifications/moshiRelay.ts`: a tiny server-side relay that reads queued notifications from `deploy/moshi_outbox/` and sends them to Moshi.
- `scripts/moshi_enqueue.sh`: queues a notification (no network required).
- `scripts/deploy_prod.sh`: queues a “Deploy complete” message at the end.

## Setup

- Add `MOSHI_WEBHOOK_TOKEN` to `.env.server` (this file is ignored by git).
- Optional: set `MOSHI_WEBHOOK_URL` (defaults to `https://api.getmoshi.app/api/webhook`).

Example:

```bash
MOSHI_WEBHOOK_TOKEN="..."
```

## Running the relay

- The relay runs inside the API process and starts when the server loads `src/focus/queries.ts`.
- It only sends notifications if `MOSHI_WEBHOOK_TOKEN` is set.

## Manual test

Queue a message:

`./scripts/moshi_enqueue.sh "Task Complete" "Your task finished!"`

## Note (Codex CLI)

In this coding assistant environment, outbound network calls (like `curl`) may require explicit approval.

Using the outbox + relay avoids needing network access from the assistant: the assistant only writes files, while the API process performs the webhook call.
