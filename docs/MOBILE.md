# Mobile apps (iOS TestFlight + Android)

Memoato ships as a web app first (`https://app.memoato.com`). For “serious app” distribution and native features (notifications),
we use a thin native wrapper via Capacitor.

## Goals

- Store presence (TestFlight/App Store + Play Store)
- Native reminders (local notifications first; push later)
- Keep one product surface (the web app) as the source of truth

## Repo structure

- Web app (Wasp): repo root
- Landing (Astro): `apps/memoato-site/`
- Mobile wrapper (Capacitor): `apps/mobile/`

This repo is open source: **never commit secrets** (Firebase configs, keystores, certs, provisioning profiles).

## App identity (HILLS Lab)

Default Capacitor identity is set to:

- App name: `Memoato`
- Bundle/application ID: `hr.hillslab.memoato` (derived from `hills-lab.hr`, without the hyphen)

If your Apple/Google accounts require a different identifier, update `apps/mobile/capacitor.config.ts`.

## Phase 1 (MVP): wrapper loads `https://app.memoato.com`

In `apps/mobile/capacitor.config.ts`, production uses:

- `server.url = https://app.memoato.com`

This keeps auth/API same-origin and avoids CORS rework. It’s also the fastest way to ship notifications + store presence.

Local dev uses live reload when:

- `CAPACITOR_LIVE_RELOAD=1`
- `CAPACITOR_SERVER_URL=http://10.0.2.2:3000` (Android emulator) or `http://localhost:3000` (iOS simulator)

## Setup (one-time)

Prereqs:

- Node.js (LTS), npm
- Wasp (for the web app)
- Xcode (for iOS) + Apple Developer Program
- Android Studio + SDKs (for Android) + Play Console

Install mobile deps:

```bash
cd apps/mobile
npm install
```

Create native projects (generated locally; not committed):

```bash
npm run cap:add:android
npm run cap:add:ios
```

Sync plugins/config after changes:

```bash
npm run cap:sync
```

## Local notifications (Reminders)

Memoato exposes a “Reminders” screen in the app UI which uses Capacitor Local Notifications.

Design rule:

- Notifications should be privacy-safe by default (generic text like “Time to check in”).

## Android best practice (Play Store)

1. Start with **Internal testing** track.
2. Use **Android App Bundle (AAB)**.
3. Enable **Play App Signing**.
4. Keep release keystore private (never in git).
5. If/when you add remote push later:
   - Use Firebase Cloud Messaging (FCM)
   - Keep `google-services.json` out of git

## iOS best practice (TestFlight)

1. Start with **TestFlight** builds before App Store review.
2. Set up App ID + capabilities early (Push can be enabled later, but local notifications don’t require APNs).
3. Keep signing assets private (never in git).

## Phase 2 (later): bundle the web app into the wrapper

Bundling the web app (instead of `server.url`) needs extra work:

- CORS/origin strategy (`capacitor://localhost` vs `https://api.memoato.com`)
- Auth/session handling
- Offline strategy + asset caching

Do this after Phase 1 ships and reminders are validated.
