# Changelog

## 2026-01-22

- Analytics: Databuddy tracking runs client-side only via `<script>` in `main.wasp` (`app.head`).
- Removed the server-side Databuddy proxy operation; `/operations/track-databuddy` no longer exists (returns `404`).
