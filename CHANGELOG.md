# Changelog

## 2026-02-04

- Categories: templates are stored in `CategoryTemplate` (used by “New category” template picker).
- Stats: respect `bucketAggregation` when computing totals (sum/avg/last depending on chart type).
- Goal semantics: fixes for multi-entry aggregation and goal comparisons.
- Removed Moshi deploy notifications integration.

## 2026-02-01

- Categories: manual ordering on Home (drag-and-drop reorder mode), persisted per user via `Category.sortOrder` (with reset).

## 2026-01-31

- Privacy modes: encrypted cloud + local-only mode.
- Timeline: new page with daily summaries, plus a system “Notes” category.

## 2026-02-02

- Categories: added `bucketAggregation` (sum/avg/last) and `goalDirection` (at_least/at_most).
- Category editor: choose bar vs line charts, how multiple entries aggregate, and goal direction.
- Defaults: Weight is now `NUMBER + line` (no new `GOAL` categories); local and server defaults updated accordingly.

## 2026-01-22

- Analytics: Databuddy tracking runs client-side only via runtime script injection in `src/shared/components/Databuddy.tsx`.
- Removed the server-side Databuddy proxy operation; `/operations/track-databuddy` no longer exists (returns `404`).
