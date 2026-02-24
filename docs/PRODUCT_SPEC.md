# Memoato product spec (draft)

## Vision & mission

Memoato is a minimalist, mobile-first personal tracking engine inspired by Timecap. The goal is to give one person a super-fast interface for capturing what matters (workouts, habits, appointments, weight) and seeing progress at a glance, with clean black-and-white surfaces, bold accent colors per category, and a chart-first mindset that can be reused by future native clients.

Memoato is:

- **Focused.** Only categories and events exist, no clutter, no AI second brain, no shared spaces.
- **API-first.** Wasp queries/actions power the domain so that native apps can simply call the same endpoints later.
- **PWA-ready.** We ship installable assets, icon meta, service worker caching, and install + analytics hooks for secondary platforms.

Memoato is also evolving toward structured journal logs:

- An entry can have optional extra fields (distance, duration, venue)
- Some metrics are derived rollups (Active kcal from multiple workout categories)
- Missing fields are allowed and analytics must show coverage

## MVP goals

1. **Home dashboard** with a grid of category cards showing emoji, accent color, quick stats, and progress bars / numeric glances depending on the category type.
2. **Category detail** with quick entry (default now, backfill with date+time), charts (line, bar, and dots), and editable history / deletions.
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
  - `period`: day/week/month/year for bar charts. Line charts have no period field.
  - `unit`: optional text (omit `x` when there is no service unit).
  - Optional extra fields schema:
    - `fieldsSchema` is a JSON definition that allows a category to capture additional structured fields per entry, for example distance or duration
  - Goals:
    - `goalWeekly`: per-period goal (used by bar charts for the selected `period`).
    - `goalValue`: target value (used by line charts like weight).
    - `goalDirection`: `at_least` (higher is better) or `at_most` (lower is better).
  - Multiple entries per bucket:
    - `bucketAggregation`: `sum` | `avg` | `last` (`bar` uses `sum`/`avg`. `line` uses `last`/`avg`).
  - Derived rollups:
    - `rollupToActiveKcal` marks kcal categories that should contribute to the Active kcal rollup
  - Optional schedule metadata for simple trackers:
    - `scheduleEnabled`, `scheduleType` (`daily` | `weekly`), `scheduleDays` (0-6), `scheduleTime` (`HH:mm`)
    - Best fit for `DO`/`DONT` categories where amount can default to 1
  - Optional manual ordering:
    - `sortOrder` is used by the Home dashboard when the user sets a custom order (drag-and-drop reorder mode).
    - New categories created after a custom order is set appear at the bottom until reordered (or the order is reset).
  - Category templates (legacy onboarding):
    - Presets exist as `CategoryTemplate` rows, but the product direction is to make them optional and move onboarding to a log-first flow (see below).

### Events

- Every event records:
  - `amount` (number, accepts integers, decimals with `.` or `,` input).
  - `createdAt` (when inserted) and `occurredAt` (timestamp with time), plus `occurredOn` (date-only) for grouping/backfilling.
  - `rawText` for quick reference and `data` to store raw import payloads.
    - `data.fields` can store optional structured values, based on the category `fieldsSchema`
  - `kind` (default `SESSION`) and optional `source`.
  - Optional duration:
    - `duration` (minutes) can be captured as a structured field for time bound sessions
  - Constraints:
    - The UI prevents selecting future dates for `occurredAt`.
  - Scheduled state metadata:
    - `data.scheduledStatus` can be `went`, `missed`, `cancelled`, or `pending` (timeline synthetic state)
    - For scheduled simple tracking, amount defaults to `1` for `went` and `0` for `missed`/`cancelled`

## Default categories & goals

Memoato starts with a built-in, non-deletable **Notes** system category.

For everything else, the intended onboarding is template free.

Instead of picking templates up front, the user logs a thing in a natural way and Memoato learns what to track:

- `300 ml water` becomes a Water metric and later prompts for a goal
- `indoor bike 240 kcal 25 min 7.4 km` becomes a workout metric with optional dimensions
- `football 1h Poljud 2 goals 780 kcal` becomes a structured match entry

We can still offer suggested starters as shortcuts, but they should never be required and they should not block the first log.

Backwards compatibility:

- Existing users can keep their current categories and goals.
- Template based category creation can remain available until log-first onboarding is fully shipped.

More categories can be added by the user. Each one can pick a type (track number, do’s, don’ts, or goal value) plus a period. Every card stores an optional emoji that sits inside a round pill with an accent border.

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
  - A quick add button (“+”) opens an add-entry modal so entries can be recorded from the grid without navigating.
  - Cards highlight (border + light tint) when goals are achieved and offer a `Link` to `/c/:slug`.
- The page includes a prominent “Add category” button and more padding between the header and main grid for clarity.

### Coach Mode v0: Next up

Home can optionally show a “Next up” card with up to 3 suggestions for goal-based categories:

- Suggestions are deterministic (no AI) and based on remaining-to-go and recent timing/frequency.
- Value-based categories (line chart, e.g. weight) are not suggested again after you already logged them today.
- Each suggestion includes a quick add button that opens the add-entry modal for that category.

### Scheduled check-ins

Home also shows a sequential scheduled check-in card when due events are not logged:

- It asks if the event happened for overdue scheduled categories
- Actions are `Went`, `Didn’t go`, and `Cancelled`
- Optional note can be saved with the response
- The queue advances to the next overdue item after each response

## Onboarding (first run)

When a user has no non-system categories, Memoato opens an onboarding screen:

- The user selects a few starter templates (multi-select).
- “Create selected” creates real categories (and the user can edit goals later).
- Notes is always present and can’t be deleted.

## Category detail

- Header: accent circle with emoji, title (capitalized), edit button (visible on desktop/mobile), and summary text (`Last: 95 kg · Goal 85 kg`, or `This week 194 / 300`).
- Add entry form:
  - Numeric/value categories use date + amount entry.
  - Simple tracking categories (`DO`/`DONT`) use date-only quick add with no required amount.
  - Scheduled simple tracking adds explicit states: `Went`, `Didn’t go`, `Cancelled`.
  - Amount input accepts decimals with dot or comma for numeric categories.
  - Add button uses black background with white text, aligned to inputs.
  - Optionally show current week summary at the top of the card.
- Charts:
  - Quick default view switcher in category header: `Chart` (line) and `Bar`. Switching persists as category default view.
  - Period picker (Day/Week/Month/Year) sits next to period navigation buttons on desktop. On mobile the picker moves right above the chart.
  - `← Prev` / `Next →` buttons change the offset (with “Next” disabled at current).
  - Bar chart shows number labels on top of each bar, touches the right edge while leaving a little padding (avoids empty space). Bars scroll horizontally with the latest period aligned to the right, and arrows help jump between spans.
  - A separate GitHub-style `Contributions` heatmap sits above history and shows per-day entry activity for the category.
  - Weekly goal line renders as a strikethrough line tinted with a lighter version of the accent color (same style as the weight goal line) with text legend.
  - Line chart (weight) auto scales and adds padding when values exceed the goal so the highest point and strikethrough label never get clipped. Value bubbles show numbers. The x-axis label simplifies months to short names (e.g., `Jan`).
- History:
  - List of entries with date/time + amount inputs, inline Save/Delete buttons, and improved spacing so items don’t crowd.
  - History can be toggled open/closed, shows “Load more” to fetch older entries, and updates analytics after edits.
  - Delete triggers a confirmation prompt.

## Profile & admin controls

- Profile page:
  - Section to edit username, first name, last name.
  - Email card showing current email + verification status. Allows requesting a confirmation email for a new email address (caller must supply email and confirm through link).
  - Password reset button sends a reset email.
  - Export data (JSON download, future ZIP option) that includes profile, categories, and events.
  - Delete account button (email confirmation, no auto-verify).
  - Layout uses black buttons and consistent spacing. Mobile-friendly adjustments (buttons full width).
  - Preferences:
    - Theme preference is stored per user (`User.themePreference`).
    - Next up visibility is stored per user (`User.nextUpEnabled`).
    - Active kcal rollup mode is stored per user (`User.activeKcalRollupEnabled`):
      - Auto: rollup is enabled unless the user logs manual Active kcal entries
      - On: always roll up kcal categories into Active kcal
      - Off: never roll up

### Auth providers

- Email + password auth (Wasp): verification is required, but usage is allowed immediately with an “unverified” indicator.
- Google auth (Wasp OAuth): optional, enabled by `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
  - `User.email` is synced from the Google profile on login so profile and exports have a usable email.

- User model:
  - `role` string (default `user`). Admins are promoted via `MEMOATO_ADMIN_EMAILS` (comma-separated env var) or manually via DB.
  - Profile data includes `firstName`, `lastName`, `createdAt`, and optional `updatedAt`.
  - Admins can access `/sudo` even if the button is hidden. Non-admins visiting the route get a 404.

- Sudo page:
  - Aggregated totals (users, categories, entries) in cards.
  - Table of users with username, email, role, registration date, categories count, and entries count (last login optional).

## Privacy modes

Memoato supports three privacy/storage modes (set in **Profile → Privacy**):

1. **Cloud sync (default)**: data is stored normally to power charts/history and support multi-device access.
2. **Encrypted cloud**: **category titles** and **per-entry notes** are encrypted client-side before saving to the DB. Users unlock with a passphrase per device (passphrase is never stored).
3. **Local-only**: categories and entries are stored on-device (IndexedDB). Switching to local-only wipes server categories/events for that account.

## Timeline behavior

- Timeline can include scheduled pending items before they happen on that day
- Scheduled rows display state (`Pending`, `Went`, `Didn’t go`, `Cancelled`) instead of numeric totals when relevant
- Notes keep per-note timestamps in the timeline list

## Analytics & PWA

- Analytics:
- Databuddy runs **client-side only** via runtime script injection (`src/shared/components/Databuddy.tsx`).
  - There is **no server-side proxy** and no `/operations/track-databuddy` endpoint.
  - Tracking is intended for `app.memoato.com` (ensure the Databuddy project allows origin `https://app.memoato.com`).

- PWA/install:
  - Manifest lists `Memoato` name, dark theme color, rounded high-res icons, maskable icon to deploy proper shape on Android (Galaxy).
  - Service worker caches the shell + icons. `app.memoato.com` should show the “Add to home screen” prompt on Android + iOS (Safari) with proper icons.
  - `favicon.ico` and PNG versions derive from the transparent white “m” logo with black circular background.
  - Regenerate icons via `python3 scripts/generate_favicons.py --also-landing`.

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
  3. Run keyword/regex mapping (future command bar logic) to assign fuzzy categories. Ambiguous rows stay in “Uncategorized”.
  4. After import, refresh stats with `getCategories`/`getCategorySeries`.

- Until the JSON export is available, keep a small sanitized sample under `imports/` (ignored by git) for local testing.

## Next steps & open questions

1. Confirm the exact JSON schema you’ll provide (top-level array? fields?).
2. Decide whether `Category` quick-add cards on the home page should capture the full `amount` + `timestamp` or just a number.
3. Validate which env vars to keep secret (Databuddy, SMTP, JWT) vs. commit as `.env.example`.
4. Agree on the analytics dashboard you want to monitor (Databuddy) and any additional attributes to send.
5. Determine whether `/sudo` should ever expose more than counts (e.g., last login).
