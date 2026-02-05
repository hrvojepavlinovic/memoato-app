# Memoato product spec (draft)

## Vision & mission

Memoato is a minimalist, mobile-first personal tracking engine inspired by Timecap. The goal is to give one person a super-fast interface for capturing what matters (workouts, habits, appointments, weight) and seeing progress at a glance—with clean black-and-white surfaces, bold accent colors per category, and a chart-first mindset that can be reused by future native clients.

Memoato is:

- **Focused.** Only categories and events exist, no clutter, no AI second brain, no shared spaces.
- **API-first.** Wasp queries/actions power the domain so that native apps can simply call the same endpoints later.
- **PWA-ready.** We ship installable assets, icon meta, service worker caching, and install + analytics hooks for secondary platforms.

## MVP goals

1. **Home dashboard** with a grid of category cards showing emoji, accent color, quick stats, and progress bars / numeric glances depending on the category type.
2. **Category detail** with quick entry (default now; backfill with date+time), charts (bars for count categories, lines for goal-value categories), and editable history / deletions.
3. **User management**: profiles can update username/name, change email (with verification), reset passwords, export data, and request account deletion. Admins gain `/sudo` with site-wide totals.
4. **Import pipeline** to ingest third-party data (JSON export) and metadata (source, createdAt/occurredOn) into Categories/Events.
5. **Production stack**: Wasp backend + React client served via PM2, exposed through Cloudflare Tunnel, connected to Postgres over a UNIX socket.
6. **Analytics / PWA**: Databuddy tracking, manifest icons, Android/iOS install prompts, and rounded home screen icons.

## Key UI primitives

### Categories

- Each category belongs to a user, has a friendly slug (`/c/:categorySlug`), and stores:
  - `title`, optional `emoji`, accent color (`accentHex`), friendly slug.
  - `categoryType`: `NUMBER` | `DO` | `DONT` (legacy `GOAL` may exist but is treated as `NUMBER`).
  - `chartType`: `bar` (totals per bucket) or `line` (values over time).
  - `period`: day/week/month/year (bar charts only; line charts have no period field).
  - `unit`: optional text (omit `x` when there is no service unit).
  - Goals:
    - `goalWeekly`: per-period goal (used by bar charts for the selected `period`).
    - `goalValue`: target value (used by line charts like weight).
    - `goalDirection`: `at_least` (higher is better) or `at_most` (lower is better).
  - Multiple entries per bucket:
    - `bucketAggregation`: `sum` | `avg` | `last` (bar charts use `sum`/`avg`; line charts use `last`/`avg`).
  - Optional manual ordering:
    - `sortOrder` is used by the Home dashboard when the user sets a custom order (drag-and-drop reorder mode).
    - New categories created after a custom order is set appear at the bottom until reordered (or the order is reset).
  - Category templates:
    - Built-in presets (emoji/accent/goals/aggregation) are stored as `CategoryTemplate` rows and shown on the “New category” page.

### Events

- Every event records:
  - `amount` (number, accepts integers, decimals with `.` or `,` input).
  - `createdAt` (when inserted) and `occurredAt` (timestamp with time), plus `occurredOn` (date-only) for grouping/backfilling.
  - `rawText` for quick reference and `data` to store raw import payloads.
  - `kind` (default `SESSION`) and optional `source`.

## Default categories & goals

Memoato starts with a built-in, non-deletable **Notes** system category.

For everything else, new users are guided through a first-run onboarding where they **multi-select templates** (weight, water, push ups, etc.).
Templates are backed by `CategoryTemplate` rows and can be reused later from the “New category” template picker.

Example starter templates:

| Title | Period | Goal | Chart | Emoji | Accent | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Water | day | 2 000 ml/day | bar | 💧 | `#0EA5E9` | Daily target |
| Push ups | week | 300 reps/week | bar | 💪 | `#F59E0B` | Weekly goal |
| Weight | N/A | 85 kg target | line | ⚖️ | `#0EA5E9` | Line chart with target |

More categories can be added by the user; each one can pick a type (track number, do’s, don’ts, or goal value) plus a period. Every card stores an optional emoji that sits inside a round pill with an accent border.

## Home dashboard

- Categories are grouped/sorted (default):
  - First: categories with progress bars (non-line categories that have a weekly goal).
  - Second: simple tracking numbers without goals.
  - Last: line/goal-value categories (e.g., weight).
  - Within each group, goal-reached cards move to the bottom to celebrate “off” status.
- If the user enables manual ordering (Home → Edit → drag handles), the custom order is used instead of the default auto ordering.
- Each card shows:
  - Emoji inside a rounded accent-border blob and the title.
  - Small “this week” / “this year” / “last value/goal” line with tabular numbers.
  - For goal/week categories, a full-width progress bar tinted with the accent color and a number on the right (e.g., `194 / 300`).
  - For tracking-only categories (Padel, Termin), show “This year” totals and label the number.
  - Optionally, show a quick “+ Add” or inline input so entries can be recorded from the grid without navigating (future iteration).
  - Cards highlight (border + light tint) when goals are achieved and offer a `Link` to `/c/:slug`.
- The page includes a prominent “Add category” button and more padding between the header and main grid for clarity.

## Onboarding (first run)

When a user has no non-system categories, Memoato opens an onboarding screen:

- The user selects a few starter templates (multi-select).
- “Create selected” creates real categories (and the user can edit goals later).
- Notes is always present and can’t be deleted.

## Category detail

- Header: accent circle with emoji, title (capitalized), edit button (visible on desktop/mobile), and summary text (`Last: 95 kg · Goal 85 kg`, or `This week 194 / 300`).
- Add entry form:
  - Date+time (`datetime-local`) defaults to current timestamp (not just today) and allows manual editing of date/time.
  - Amount input accepts decimals with dot or comma.
  - Add button uses black background with white text, aligned to inputs.
  - Optionally show current week summary at the top of the card.
- Charts:
  - Period picker (Day/Week/Month/Year) sits next to period navigation buttons on desktop; on mobile the picker moves right above the chart.
  - `← Prev` / `Next →` buttons change the offset (with “Next” disabled at current).
  - Bar chart shows number labels on top of each bar, touches the right edge while leaving a little padding (avoids empty space). Bars scroll horizontally with the latest period aligned to the right, and arrows help jump between spans.
  - Weekly goal line renders as a strikethrough line tinted with a lighter version of the accent color (same style as the weight goal line) with text legend.
  - Line chart (weight) auto scales and adds padding when values exceed the goal so the highest point and strikethrough label never get clipped. Value bubbles show numbers; the x-axis label simplifies months to short names (e.g., `Jan`).
- History:
  - List of entries with date/time + amount inputs, inline Save/Delete buttons, and improved spacing so items don’t crowd.
  - History can be toggled open/closed, shows “Load more” to fetch older entries, and updates analytics after edits.
  - Delete triggers a confirmation prompt.

## Profile & admin controls

- Profile page:
  - Section to edit username, first name, last name.
  - Email card showing current email + verification status; allows requesting a confirmation email for a new email address (caller must supply email and confirm through link).
  - Password reset button sends a reset email.
  - Export data (JSON download; future ZIP option) that includes profile, categories, and events.
  - Delete account button (email confirmation; no auto-verify).
  - Layout uses black buttons and consistent spacing; mobile-friendly adjustments (buttons full width).

- User model:
  - `role` string (default `user`). Admins are promoted via `MEMOATO_ADMIN_EMAILS` (comma-separated env var) or manually via DB.
  - Profile data includes `firstName`, `lastName`, `createdAt`, and optional `updatedAt`.
  - Admins can access `/sudo` even if the button is hidden; non-admins visiting the route get a 404.

- Sudo page:
  - Aggregated totals (users, categories, entries) in cards.
  - Table of users with username, email, role, registration date, categories count, and entries count (last login optional).

## Privacy modes

Memoato supports three privacy/storage modes (set in **Profile → Privacy**):

1. **Cloud sync (default)**: data is stored normally to power charts/history and support multi-device access.
2. **Encrypted cloud**: **category titles** and **per-entry notes** are encrypted client-side before saving to the DB; users unlock with a passphrase per device (passphrase is never stored).
3. **Local-only**: categories and entries are stored on-device (IndexedDB). Switching to local-only wipes server categories/events for that account.

## Analytics & PWA

- Analytics:
- Databuddy runs **client-side only** via runtime script injection (`src/shared/components/Databuddy.tsx`).
  - There is **no server-side proxy** and no `/operations/track-databuddy` endpoint.
  - Tracking is intended for `app.memoato.com` (ensure the Databuddy project allows origin `https://app.memoato.com`).

- PWA/install:
  - Manifest lists `Memoato` name, dark theme color, rounded high-res icons, maskable icon to deploy proper shape on Android (Galaxy).
  - Service worker caches the shell + icons. `app.memoato.com` should show the “Add to home screen” prompt on Android + iOS (Safari) with proper icons.
  - `favicon.ico` and PNG versions derive from the transparent white “m” logo with black circular background.

## Deployment & operations

- Local dev:
  - Database: Postgres via UNIX socket at `/var/run/postgresql`, user `harvey`, DB `memoato`. Credentials stored in `.env.server`.
  - Wasp workflow: `wasp db migrate-dev`, `wasp start`. `vite.config.ts` should allow `preview.allowedHosts` for `app.memoato.com` during closed tunnel testing.
  - `.env.client`/`.env.server` hold API URLs, SMTP credentials, JWT secret, and Databuddy client IDs.

- Production:
  - Build script `./scripts/deploy_prod.sh`.
  - PM2 runs `memoato-web` on 5050 and `memoato-api` on 5051. Ensure log rotation (e.g., `pm2-logrotate`) to avoid disk bloat.
  - Cloudflare Tunnel routes (config template in `deploy/cloudflared-memoato.example.yml`):
    - `app.memoato.com` → `http://127.0.0.1:5050`
    - `api.memoato.com` → `http://127.0.0.1:5051`
  - Optionally use `dev.memoato.com` if `app.memoato.com` is claimed.
  - Deployments are non-breaking via `deploy/current` symlink (see `scripts/run_*_prod.sh`).

## Import plan

- We’re expecting a JSON export (e.g., the `tell` export provided via Tailscale) containing activity/session data. Steps:
  1. Drop the raw file into `imports/` and record metadata (`source`, `exportedAt`, `filename`).
  2. Transform into Categories + Events:
     - Map source categories to our `Category` table (title, emoji, accent, type, period).
     - Parse timestamps into `occurredAt` (with time) and `occurredOn` (date). Keep `createdAt` as the import time.
     - Save raw payload into `Event.data` for traceability.
  3. Run keyword/regex mapping (future command bar logic) to assign fuzzy categories; ambiguous rows stay in “Uncategorized”.
  4. After import, refresh stats with `getCategories`/`getCategorySeries`.

- Until the JSON export is available, keep a small sanitized sample under `imports/` (ignored by git) for local testing.

## Next steps & open questions

1. Confirm the exact JSON schema you’ll provide (top-level array? fields?).
2. Decide whether `Category` quick-add cards on the home page should capture the full `amount` + `timestamp` or just a number.
3. Validate which env vars to keep secret (Databuddy, SMTP, JWT) vs. commit as `.env.example`.
4. Agree on the analytics dashboard you want to monitor (Databuddy) and any additional attributes to send.
5. Determine whether `/sudo` should ever expose more than counts (e.g., last login).
