# Typed workout metrics contract

Status: code complete on `codex/nested-exercise-workouts`; production migration and historical backfill require explicit approval.

## Invariants

- The immutable raw `Event(kind=NOTE)` is the evidence source.
- One performed sport/workout is one parent `Event(kind=SESSION)`.
- `WorkoutMetric` rows are typed dimensions of that parent and never create additional sessions.
- `(workoutEventId, key)` is unique, making writes idempotent.
- A metric-bearing label projects only with `executionStatus=performed`. Planned and reported labels remain queryable facts without a completed event.
- `active_kcal` is a component eligible for `daily_active_kcal`; `total_kcal` is distinct total workout energy and is always excluded from that rollup.
- If a manual Active Calories daily total is logged later, that total replaces components for that date. Components are also deduplicated by stable workout key.

## MCP/ingest input

Attach `workout` to the single performed parent label:

```json
{
  "kind": "movement",
  "label": "football",
  "executionStatus": "performed",
  "workout": {
    "durationSeconds": 4022,
    "distanceKm": 4.08,
    "activeKcal": 876,
    "totalKcal": 1016,
    "averageHeartRateBpm": 162,
    "minHeartRateBpm": 78,
    "maxHeartRateBpm": 189,
    "perceivedEffort": { "value": 8, "label": "Hard" }
  }
}
```

The ingest transaction creates the parent event, embeds a versioned compatibility payload in `Event.data.workout`, and inserts typed child rows. Reprocessing deletes/rebuilds derived events and cascades their metrics; it never rewrites the raw NOTE.

## History and comparison

Category history displays exact duration, distance, active/total calories, heart-rate dimensions and effort on the parent workout card. It compares each workout against the immediately previous completed session in the same category, and only compares matching metric keys and units.

## Production rollout gate

1. Take a database backup and run `prisma migrate status`.
2. Preview the additive migration SQL in `migrations/20260807143000_add_workout_metrics/migration.sql`.
3. Apply the migration before deploying code that writes `WorkoutMetric`.
4. Smoke-test one new performed workout and one planned-only note.
5. Preview historical backfill counts and exact event IDs. Do not bulk reprocess raw entries.
6. For the already-corrected Football event `4168c393-d485-46c7-a141-647f2f3fc59f`, copy its eight existing `Event.data.workout.metrics` values into `WorkoutMetric` with upserts. This bounded backfill must not alter its raw, event identity, context facts, results, or goals.
7. Verify one Football session, eight unique metrics, unchanged raw hash, and daily active-calorie behavior before accepting rollout.

Rollback before application is simply “do not apply.” After application but before writes, drop only the new table. After writes, export the table first; the embedded event payload preserves compatibility, but rollback still requires explicit approval.
