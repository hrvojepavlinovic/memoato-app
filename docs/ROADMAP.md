# Memoato roadmap & product signals

## Vision & mission

Memoato is the fast, minimalist tracker that replaces bulky spreadsheets and fuzzy reminders. The mission is to let a single user capture meaningful health, habit, and appointment data with as little friction as possible—typing a number, hitting Enter, and seeing a clear, colorful dashboard while the API remains reusable for future native apps.

## Pillars

1. **Focused capture.** Home dashboard cards surfacing progress bars, accent colors, emoji, and quick “this week” totals so nothing needs to be dug out of menus.
2. **Reliable API.** Wasp queries/actions should encapsulate the domain logic so any client (web, mobile, CLI) can reuse classification, events, and history.
3. **Delightful instrumentation.** Databuddy analytics plus PWA/install support make the experience feel like a polished native app.
4. **Privacy-conscious operations.** Local Postgres over sockets, PM2 deployments with log rotation, Cloudflare Tunnel for the public face, Zoho SMTP for email verification.

## Milestones

| Phase | Focus | Success metrics |
| --- | --- | --- |
| 1. Foundation | Wasp + Prisma schema, DB setup (`memoato`), default categories, basic dashboard + category detail, import plan drafted. | `wasp db migrate-dev` succeeds, default categories seeded, user can add/edit events, profile page available. |
| 2. Experience polish | Accent-based progress bars, strikethrough goal lines, history editing/deletion, responsive layout tweaks (period picker placement, mobile-friendly charts, button alignment). | All categories show colored progress bars or glances, charts auto-scroll to latest period, history entries are editable. |
| 3. Ops & analytics | PM2+Cloudflare deployment, Databuddy instrumentation, PWA install prompts, manifest + icons, default 404, log rotation, `/sudo` admin insights. | App accessible via `app.memoato.com`, analytics dashboard shows events, install prompt triggers on Android/iOS, `/sudo` works for admins. |
| 4. Import & export | JSON import path defined, raw payload stored, profile export available, admin insights include import metadata. | JSON exports can be ingested, profile export downloads categories/events, admin sees counts per user. |

## Monetization (hypothesis)

- **Freemium tracking.** Base categories/events are free. Premium features (e.g., private coaching templates, advanced analytics, unlimited history exports, sync to other services) can unlock via a subscription.
- **Data-friendly upsell.** Offer guided templates or AI-run summaries (after building the command bar / second brain) as paid extras.
- **Custom branding.** Agencies or teams might pay to add custom icons, colors, or integrate with their own analytics systems.

## Technical next steps

1. Harden the import story once the JSON export arrives: determine schema, write transformation logic, and persist raw data + mapping details.
2. Improve bar/line charts so the latest bucket is flush right, values don’t get clipped, and goal strikethroughs reuse an accent-lighter stroke+label.
3. Tune mobile layouts (period picker placement, progress bars full-width, inputs sized properly) and ensure login/signup buttons stay black even during loading (no yellow flicker).
4. Add request/response tracking for profile export, async email confirmations, and dataset deletion flows.
5. Automate PM2 log rotation (e.g., `pm2 install pm2-logrotate`) and surface any errors from `pm2 logs`.
6. Expand `/sudo` to show total users/categories/entries + per-user stats and optionally last login time (post-auth integration).
7. Ensure Databuddy works on `app.memoato.com` (origin must match `https://app.memoato.com`).

## Questions for you (please answer in order so we can iterate)

1. Do we keep the command-bar/Spotlight concept for the MVP, or postpone until after the core dashboards are solid?
2. Which JSON export fields are guaranteed (timestamp, category, amount, tags)? Are there nested structures or arrays we should be ready for?
3. Should “quick add” from the home dashboard capture both amount and timestamp, or only the count (with default timestamp = now)?
4. When a category has no unit, should the UI simply hide the unit suffix (instead of showing `x`)?
5. Should Padels/Termins always show “This year” totals on the home cards? Do we ever need “This week” there as well?
6. When a goal is reached, should the card move to the bottom of its group (yes) and should it also show a different border (e.g., full accent border and lighter background)?
7. Do we want to provide the ability to edit category color/emoji from the category detail page, or keep it on a separate “Edit category” route?
8. How should the `/history` list look on mobile—open by default or behind a “Show history” toggle?
9. What’s the ideal flow for weight entries? Do we allow multiple decimals (95,15) and show the exact precision the user entered?
10. Should we persist the time portion when the user manually picks a date in the add-entry form, or always default to noon for backfilled days?
11. Do we need to track “last login” for users on the `/sudo` page, or are createdAt + counts enough?
12. Would you like `/sudo` to expose any filters (by role, date range) or stick to a simple table for now?
13. For analytics, is Databuddy enough, or do you want to capture any custom events (e.g., category created, entry deleted)?
14. On Android, should the rounded home-screen icon just be a maskable version of the current logo, or do you want a separate asset with a black circle background?
15. Do you expect memoato to be multi-user in the future (share categories), or keep it single-user with role-based admin tooling?
16. What’s your preferred cadence for deployments (manual via `./scripts/deploy_prod.sh` + pm2, or automated pipeline)?
17. Would you like to keep the public API on `api.memoato.com` for server-side clients (curl, native apps), or consider a single domain for both client/api?
18. Should “Add category” support templates (pre-filled color/emoji/goal), or start from scratch every time?
19. What should the “export data” bundle include? (Profile + categories + events is the minimum—do you want zipped attachments later?)
20. How should we handle blocked hosts during local dev (vite preview)? Add `app.memoato.com` to `preview.allowedHosts`, or wrap the tunnel differently?

## Next actions after your answers

1. Implement the import pipeline + classification rules.
2. Deliver the remaining UX polish (charts, responsive history, quick-add, strikethrough colors).
3. Harden the deployment docs with logs/rotation details and Cloudflare tunnel guidance.
4. Validate analytics and PWA install experiences (Android + iOS home screen prompts).
