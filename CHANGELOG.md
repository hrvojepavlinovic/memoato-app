# Changelog

## 2026-02-02

- Categories: added `bucketAggregation` (sum/avg/last) and `goalDirection` (at_least/at_most).
- Category editor: choose bar vs line charts, how multiple entries aggregate, and goal direction.
- Defaults: Weight is now `NUMBER + line` (no new `GOAL` categories); local and server defaults updated accordingly.

## 2026-01-22

- Analytics: Databuddy tracking runs client-side only via `<script>` in `main.wasp` (`app.head`).
- Removed the server-side Databuddy proxy operation; `/operations/track-databuddy` no longer exists (returns `404`).
