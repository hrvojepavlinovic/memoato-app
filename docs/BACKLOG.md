# Backlog

This is a living list of what to do next. Keep it short and reorder often.

## P0 (bugs / correctness)

- After deploy, verify legacy “goal value” categories can be switched to `bar + sum` (e.g. Water intake: two `300ml` entries should show `600ml` for the day).
- Audit any remaining places that still allow selecting future dates for `occurredAt`.

## P0 (speed / activation)

- Home: add “Quick log” (one-tap, keyboard-first) so time-to-log is ~10s on mobile.
- Improve onboarding activation (log-first flow, infer metrics, suggest goals at the right moment, explain Notes).
- Improve “predict next log” (recency + time-of-day heuristic, no AI required).
- Add parsing for common units and hints (ml, kg, kcal, min, km) so natural logs become structured data over time.
- Add alias memory so text like `water` or `bike` matches existing categories.
- Add a fast create flow when a log does not match any category (pre fill title and unit, no goal required).
- Add progressive goal prompts after the user has logged a category a few times.

## P1 (UX)

- Landing page: add real screenshots (replace placeholders) and tune mobile spacing.
- Landing page: add a simple FAQ section on the homepage to reduce clicks.
- App: reduce any remaining layout shift/flicker on auth/profile transitions.
- App: add optional per-entry note editing UX polish (keyboard, spacing, truncation).
- Categories: add simple categorization (tags or folders) so users can group trackers.
- Categories: explore richer “custom fields” without bloating logging speed.
- Structured logging implementation plan: `docs/LOG_FIRST_IMPLEMENTATION.md`.

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
- Home: shipped “Next up” (Coach Mode v0), limited to 3 items, stored per user.
- Profile: persist theme preference and Next up visibility in the DB (per user).
- Auth: shipped Google login via Wasp auth.
- Entries: disallow future dates.
- Mobile: scaffolded Capacitor wrapper and reminders UI (mobile-only controls hidden on web).
- PWA: install prompt, install button, updated icons (maskable + rounded).
- Site: SEO upgrades (sitemap, robots, JSON-LD, `llms.txt`), new intent pages and `/adhd`.
