# Log first implementation plan

This document turns the structured logging vision into an implementation plan.

The goal is to keep Memoato minimal, fast, and ADHD friendly while making logs richer over time.

## Product principles

- Log speed first: a good log takes under 3 seconds
- Ask fewer questions, later: do not block the first log
- Backwards compatibility: existing categories and logs keep working
- Deterministic by default: no AI is required to get value
- Coverage is honest: missing fields do not poison analytics, but coverage must be visible

## What we are building

Users can type natural logs like:

- `300 ml water`
- `95.3 kg`
- `indoor bike 240 kcal 25 min 7.4 km`
- `football 1h Poljud 2 goals 780 kcal`

Memoato should:

1. Pick a primary category (or offer the top 3 choices)
2. Extract a primary value and unit
3. Extract optional extra fields (duration, distance, venue, goals)
4. Save the event with structured fields
5. Roll up kcal categories into Active kcal automatically, with manual corrections supported

## Non goals for the first iteration

- Full accounting system and double entry bookkeeping
- Deep nested project management UI
- Auto tracking via background sensors
- AI only features that break without cloud access

## Phase plan

### Phase 0: Stabilize the core flow (already started)

- Active kcal rollup with user mode: Auto, On, Off
- Per category toggle: counts toward Active kcal
- Optional extra fields per category via a small schema definition

### Phase 1: Input parser and suggestion engine

Add a deterministic parser that converts raw input into a structured candidate:

- Extract numbers and decimals
- Extract units
- Extract duration tokens (`25m`, `25 min`, `1h`, `1h 20m`)
- Extract distances (`7.4km`)
- Keep leftover words as label candidates (`water`, `football`, `poljud`)

Output example:

```json
{
  "primary": { "value": 240, "unit": "kcal" },
  "fields": [
    { "key": "duration", "value": 25, "unit": "min" },
    { "key": "distance", "value": 7.4, "unit": "km" }
  ],
  "labels": ["indoor", "bike"]
}
```

Then score categories using a lightweight model:

- Recency and time of day patterns
- Typical frequency per day (categories that are usually one per day should not be suggested if already logged today)
- Unit match (kcal, kg, ml, steps)
- Text match against category title and stored aliases

UI:

- Show one primary suggestion and up to 2 alternates
- One tap to switch category
- Enter saves, Escape closes

### Phase 2: Alias memory and first time category creation

When the parser sees labels that do not match any existing category, offer a fast create flow:

- Pre fill title from label
- Pre fill unit from extracted unit
- Ask for emoji later (optional)
- Do not force goal setup during creation

Store alias phrases so future logs match faster:

- `water`, `water intake`, `h2o` -> Water category
- `bike`, `indoor bike` -> Indoor bike category

### Phase 3: Progressive goal prompts

Prompt for a goal only after we have enough signal:

- After N logs for a category (for example 3)
- After the user logs on 2 different days
- Or when the user opens the category detail page

Prompt shape:

- Suggest a goal based on a simple heuristic (median daily total for the last 7 active days)
- One tap accept
- One tap skip

### Phase 4: Coverage and rollup transparency

Anywhere we show analytics that depend on optional fields:

- Show coverage like `11 of 14 sessions include distance`
- Allow filtering charts to only sessions with required fields

For Active kcal:

- Show breakdown: total Active kcal with sources
- Support manual corrections so total can match a wearable

## Data model notes (backwards compatible)

Keep the existing Category and Event model.

Extend with optional fields only:

- Category: `fieldsSchema` (optional JSON)
- Category: `rollupToActiveKcal` (boolean, for kcal categories)
- Event: `data.fields` (optional JSON object or array)
- Event: `duration` (optional minutes)
- User: `activeKcalRollupEnabled` (null, true, false)

Optional future additions:

- `CategoryAlias` table for explicit label matching
- `DerivedMetric` table for rollups beyond Active kcal

## Performance considerations

- Do parsing client side, it is fast and avoids round trips
- Compute suggestion scores with pre fetched category metadata
- Keep the payload small and avoid fetching history on every keystroke
- Compute rollups in queries server side, but keep them simple and indexed

## Acceptance criteria for Phase 1

- User can type `300 ml water` and get a correct top suggestion for Water when it exists
- User can type `95.3 kg` and get Weight as the top suggestion when it exists
- If the user types only a number, current numeric suggestion behavior remains intact
- Saving creates one event only, never duplicates
- The UI remains fast on mobile, including when the keyboard is open

