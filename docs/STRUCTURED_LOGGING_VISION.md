# Structured logging vision

Memoato started as a fast habit tracker. The next evolution can be a lightweight system for structured journal logs where each log entry can carry multiple dimensions, can be time bound, and can roll up into other metrics.

The goal is not to turn Memoato into a complex database UI. The goal is to keep logging under 3 seconds while making the data rich enough to answer real questions later.

## Template free onboarding (log first, learn as you go)

Long term, Memoato should not depend on picking templates during onboarding.

The default flow should be:

1. You log a thing in a natural way
2. Memoato recognizes what it is and starts tracking it
3. Memoato asks only the minimum follow up questions, only when it matters

Example:

- You log `300 ml water`
  - Memoato starts a Water metric
  - Later it prompts for a daily goal (or suggests one)

- You log `indoor bike 240 kcal 25 min 7.4 km`
  - Memoato starts tracking Indoor bike
  - It stores kcal as the primary value
  - It stores minutes and km as optional extra fields
  - It rolls kcal into Active kcal automatically (see rollups)

- You log `football 1h Poljud 2 goals 780 kcal`
  - Memoato starts tracking Football matches
  - It stores duration, venue, goals, and kcal as structured fields
  - It rolls kcal into Active kcal

Important: this can start as deterministic parsing and gradual suggestions. AI can be optional later. The UX should stay snappy even without AI.

## What changes in mindset

Instead of thinking "an entry belongs to one category and has one value", think:

- An entry is an event in time
- An event can have a primary metric and optional extra fields
- Missing fields are allowed and should not poison analytics
- Analytics should show coverage so you know how much data is included

Examples:

- Fitness: indoor bike at 09:20 with kcal, km, duration
- Fitness: second indoor bike entry with only kcal, still valid for calories but excluded from km averages
- Finance: income, expense, account, counterparty, inventory item, corrections

## Core building blocks

### 1) Category as a metric definition

Keep categories. Categories remain the simplest mental model and the fastest UI.

A category defines:

- Primary metric (value, unit, aggregation)
- Period (day, week, month, year)
- Goal (optional)
- Typical frequency (usually once per day vs many times per day)
- Optional fields schema (see below)

This preserves the current "tiles + quick log" experience.

### 2) Entry as an event

An entry becomes an event with:

- `occurredAt` (required, already exists conceptually)
- Optional `startAt` and `endAt`, or `durationMinutes`
- `value` for the primary metric (optional for notes)
- `fields` for extra dimensions (optional, sparse)
- `tags` (optional) for cross cutting labels

This enables:

- Workouts as sessions in a real timeline
- Time allocation views later without forcing a calendar planner today

### 3) Fields as optional dimensions

Add optional fields per category. Each field has:

- Key, label, type (number, text, enum)
- Optional unit
- Optional validation rules

Fitness example for "Indoor Bike":

- Primary: `kcal`
- Fields: `km`, `minutes`, `avgHr` (optional)

Analytics rule:

- Total kcal includes all entries with kcal present
- Avg km per session includes only entries where `km` is present
- UI displays coverage, for example "11 of 14 sessions include distance"

### 4) Derived metrics and rollups

Some metrics should be computable from others.

Example:

- "Active kcal" includes "Indoor Bike kcal" and "Run kcal" and any other category that emits kcal

This can be implemented as derived categories, defined by a simple mapping rule:

- Which categories contribute
- Which field or primary value is used
- How to aggregate

Important:

- Derived metrics should stay optional
- The user should be able to understand what is included

Active kcal is the first rollup to support because it is a very common need.

Key principle:

- You should not have to log calories twice
- You should still be able to add manual corrections so the total matches a wearable or a daily summary

### 5) Context hierarchy for "why" (optional)

The feedback about "Goal to project to task" is a different axis than metrics.

Treat it as context, not as categories.

One simple approach:

- An entry can have a `contextPath` like `Goal/Project/Task`
- This is independent from the category and can be used for time allocation rollups

This keeps the metric system clean while enabling the "intention vs actual" views later.

## How finance fits without becoming accounting software

Finance can still be "structured logs" without full double entry accounting.

Core event types to support:

- Income
- Expense
- Transfer
- Adjustment (black box correction)

Fields for finance entries:

- Amount, currency
- Account (Revolut, bank, cash)
- Counterparty
- Merchant
- Inventory item (optional link)
- Bill usage fields for utilities (kwh, m3, etc)

Inventory can be a lightweight view built from entries tagged as purchases that include an inventory field. It can stay read only at first.

Key product boundary:

- Memoato tracks "what happened" and "what it means for my balance and habits"
- Memoato does not try to replace full accounting tools

## What I would change in Memoato to support this

### Phase 1, minimal schema changes, fast iteration

- Add optional duration to entries (`startAt` and `endAt` or `durationMinutes`)
- Add `fields` JSON to entries for extra dimensions
- Add category level field definitions so UI can render and validate fields
- Update analytics code paths to:
  - Exclude missing values from averages
  - Return coverage counts

### Phase 2, derived metrics

- Add derived category definitions
- Compute rollups server side for speed
- Expose derived metrics in tiles and charts

### Phase 3, context hierarchy and time allocation

- Add optional `contextPath` on entries
- Add a simple "plan vs actual" view
- Add rollups by context level and by day

## Categories vs tags vs labels

Recommendation:

- Categories stay the primary way to log and view metrics
- Tags are optional and cross cutting
- Context paths enable nested categorisation and rollups without exploding the category list

This avoids:

- A giant category taxonomy
- A UI that feels like a database

## Goals and multi dimensional entries

The simplest version of goals is what Memoato already does today. A category can have a goal for its primary metric and period.

Once entries can have extra fields and durations, goals can evolve into a separate layer without breaking the existing model.

Principles:

- A goal is a target for a specific metric
- A metric can be a category primary value or a category field, for example indoor bike `kcal` or indoor bike `km`
- One entry can contribute to multiple goals
- Missing fields should not break goals, they just reduce coverage

Examples:

- Weight goal can reference the Weight category primary value, using the last value each day
- Cardio goal can reference Indoor Bike `minutes` and Run `minutes`
- Active kcal goal can be derived, summing kcal from multiple workout categories

How to model it, backwards compatible:

- Keep category goals as the default simple path
- Add optional explicit goals that can reference:
  - category primary value
  - category field key
  - derived rollup metric
- Add contribution rules that define what contributes to a goal:
  - which categories and which field or value is used
  - how it aggregates
  - optional coefficient, for example 0.5x for low confidence signals

Coverage and trust:

- Any goal view that uses optional fields must show coverage, for example 11 of 14 sessions include minutes
- For derived goals, the UI must show what is included so it is never a black box

UX, keep friction low:

- Auto link contributions by rules so logging stays fast
- Allow an entry to override contributions only when needed
- Surface the goal impact in the review, not during the log flow by default

## UX principles to keep it ADHD friendly

- Logging should still be fast with one input and one tap
- Extra fields should be optional and only shown when relevant
- Coverage should be visible but not shaming
- The system should guess based on your history and still be easy to override

## Open questions to decide later

- Should durations be inferred when two entries for the same category are close together
- Should we support true "sessions" with child entries, or keep everything as single events with fields
- How much of finance needs first class entities like accounts and inventory vs fields only
