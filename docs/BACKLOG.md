# Backlog

This is a living list of what to do next. Keep it short and reorder often.

## P0 (bugs / correctness)

- After deploy, verify legacy “goal value” categories can be switched to `bar + sum` (e.g. Water intake: two `300ml` entries should show `600ml` for the day).

## P0 (speed / activation)

- Home: add “Quick log” (one-tap, keyboard-first) so time-to-log is ~10s on mobile.
- Add “predict next log” suggestions (recency + time-of-day heuristic; no AI required).
- Add an optional command-bar style input (e.g. `push ups 30`, `weight 85.2`) to reduce taps.

## P1 (UX)

- Landing page: add real screenshots (replace placeholders) and tune mobile spacing.
- Landing page: add a simple FAQ section on the homepage to reduce clicks.
- App: reduce any remaining layout shift/flicker on auth/profile transitions.
- App: add optional per-entry note editing UX polish (keyboard, spacing, truncation).

## P2 (community + marketing)

- Add a “Feedback” link in app + landing that points to GitHub Discussions/Issues.
- Add a simple voting mechanism (initially: GitHub Discussions + labels, later: in-app board).
- Prepare launch assets (short demo clips + 3 screenshots) and schedule posts.

## Ops / maintenance

- Add a minimal “release checklist” step to validate Cloudflare Pages deployed latest commit.
- Add a weekly dependency update routine (avoid breaking changes unless needed).
- Set up a basic uptime monitor (status page optional).

## Recently done

- Fixed intermittent Cloudflare 403 when navigating `memoato.com` → `app.memoato.com`.
- Reviewed/fixed email flows end-to-end (signup, verify, reset, email change, account deletion).
