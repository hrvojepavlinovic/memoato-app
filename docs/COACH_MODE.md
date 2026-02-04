# Coach Mode (AI insights + planning) — one-pager

Memoato’s next chapter is **Coach Mode**: an optional layer that turns tracking into gentle, context-aware planning and weekly feedback — without becoming a generic todo app.

## What it is (TL;DR)

- **Planning:** “What should I do today?” becomes a small, auto-generated **Daily Plan** derived from your existing goals and recent activity (e.g., “Push ups: 120 today”).
- **Feedback:** “How am I doing?” becomes a **Weekly Review** that highlights patterns, missed goals, and the smallest change to get back on track.
- **Tracking-first:** completing a plan item should create/confirm real `Event` entries so charts and history stay the source of truth.

## Eligibility + privacy contract

Coach Mode is available only when Memoato can safely compute on the user’s data:

- **Cloud sync:** eligible.
- **Encrypted cloud:** off by default; can be enabled only if the user explicitly opts in to AI analyzing decrypted data on the server (clear “what data is used” consent).
- **Local-only:** not eligible (unless a future on-device AI path exists).

Data handling principles:
- **Opt-in, reversible:** a single toggle in settings; disable = stop AI processing immediately.
- **Minimize retention:** store raw data in existing tables; store only compact derived artifacts (weekly summaries, suggested plans) with a clear delete button.
- **No surprises:** show exactly which fields are used (categories, amounts, timestamps, notes if opted in).

## UX surfaces (minimal set)

1. **Home → Plan**
   - “Today” list of 3–7 plan items (category-aware).
   - Each item shows remaining weekly goal context: “120 today (180 left / 3 days)”.
   - Tap to log → opens a focused “Add entry” for that category (default now), then marks the plan item complete.
   - “Snooze to tomorrow” and “Skip” (tracked so coaching can adapt).

2. **Home → Review (Weekly)**
   - A short narrative + bullet “wins / misses / next week tweak”.
   - Per-category insights: best day/time, typical session size, trend vs goal.

3. **Category detail → Plan next**
   - Quick action: “Add to today’s plan” or “Schedule tomorrow”.

4. **Settings → Coach Mode**
   - Toggle + privacy disclosure.
   - Controls:
     - Include notes in AI (default off).
     - “Delete Coach data” (summaries + plan history).

## Planning model (tracking-first)

Daily Plan items are not separate from tracking — they’re a structured way to guide event creation.

MVP rules (non-AI):
- Use `goalWeekly` + remaining days in week to compute “suggested today” amounts.
- If the user already logged some amount today, show “remaining today”.
- Keep it small: prioritize categories with goals and low recent completion.

AI enhancements (later):
- Suggest splits (“2 × 60” instead of “120 once”).
- Learn preferred times and session sizes.
- Explain misses without guilt (“You usually log after 6pm; want a reminder?”).

## AI outputs (strictly bounded)

Coach Mode AI should only produce:
- Weekly summaries (patterns, deltas, gentle suggestions).
- Plan suggestions (small actionable tasks).
- Simple anomalies (“weight trend changed”, “gap in logging”).

Explicit non-goals:
- Medical advice, diagnosis, “treatment plans”.
- Long-form journaling or “second brain”.
- Social features or shared plans.

## Monetization + BYOK

Recommended packaging:
- **Free:** tracking (categories/events), charts, timeline, privacy modes.
- **Pro (subscription):** Coach Mode (plan + weekly review + AI insights) for hosted `app.memoato.com`.

Self-hosting options:
- **BYOK (server-level):** instance owner supplies AI provider key in `.env.server`; Coach Mode works without Memoato paying inference costs.
- Keep hosted and self-hosted aligned on UX; only the billing/key source differs.

## Rollout plan (de-risked)

1. **Phase A (no AI):** Daily Plan using deterministic rules + “complete by logging” loop.
2. **Phase B (AI weekly review):** server-generated weekly summary; user feedback prompt (“Was this helpful?”).
3. **Phase C (AI planning):** AI suggests daily plan variants; user can accept/edit.

Success metrics:
- Activation: % of new users who complete a plan item in first 24h.
- Retention: D7 and tracked-days/week per active user.
- Efficiency: median time “open → log” stays under ~10s on mobile.
