# Changelog

## 2026-02-10

- Auth: Google login (Wasp OAuth), plus profile fixes for OAuth accounts.
- Build: patched Wasp OAuth typing issues and synced OAuth email into `User.email` on login.

## 2026-02-09

- Landing: published “Next up” posts (user-facing) on the blog.

## 2026-02-08

- Home: shipped “Next up” suggestions (Coach Mode v0), time-aware ordering, max 3 items.
- Profile: stored theme preference and Next up visibility in the DB per user.
- Entries: blocked selecting future dates in add and edit flows.
- Landing: new intent pages and `/adhd`, plus content polish.

## 2026-02-07

- Home: revamped category tiles and added quick add from tiles.
- Landing: SEO upgrades (sitemap, robots, JSON-LD, `llms.txt`) and improved OpenGraph metadata.

## 2026-02-06

- Mobile: scaffolded Capacitor wrapper and Reminders UI for local notifications.
- Reminders: improved daily reminder UI and hid native-only controls on web.
- Landing: refreshed copy and /about.

## 2026-02-05

- Onboarding: first-run template multi-select at `/onboarding` (Notes is always included).
- Templates: added Weight and Push ups to `CategoryTemplate` seeds.
- PWA: install banner, in-app install button, and improved icons (maskable and rounded).
- New category: dropdown padding and chevron alignment.

## 2026-02-04

- Categories: templates are stored in `CategoryTemplate` (used by “New category” template picker).
- Stats: respect `bucketAggregation` when computing totals (sum/avg/last depending on chart type).
- Goal semantics: fixes for multi-entry aggregation and goal comparisons.
- Removed Moshi deploy notifications integration.

## 2026-02-02

- Categories: added `bucketAggregation` (sum/avg/last) and `goalDirection` (at_least/at_most).
- Category editor: choose bar vs line charts, how multiple entries aggregate, and goal direction.
- Defaults: Weight is now `NUMBER + line` (no new `GOAL` categories). Local and server defaults updated accordingly.

## 2026-02-01

- Categories: manual ordering on Home (drag-and-drop reorder mode), persisted per user via `Category.sortOrder` (with reset).

## 2026-01-31

- Privacy modes: encrypted cloud + local-only mode.
- Timeline: new page with daily summaries, plus a system “Notes” category.

## 2026-01-22

- Analytics: Databuddy tracking runs client-side only via runtime script injection in `src/shared/components/Databuddy.tsx`.
- Removed the server-side Databuddy proxy operation. `/operations/track-databuddy` no longer exists (returns `404`).
