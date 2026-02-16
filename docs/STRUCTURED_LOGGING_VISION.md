# Structured logging vision

Memoato started as a fast habit tracker. The next evolution can be a lightweight system for structured journal logs where each log entry can carry multiple dimensions, can be time bound, and can roll up into other metrics.

The goal is not to turn Memoato into a complex database UI. The goal is to keep logging under 3 seconds while making the data rich enough to answer real questions later.

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

## UX principles to keep it ADHD friendly

- Logging should still be fast with one input and one tap
- Extra fields should be optional and only shown when relevant
- Coverage should be visible but not shaming
- The system should guess based on your history and still be easy to override

## Open questions to decide later

- Should durations be inferred when two entries for the same category are close together
- Should we support true "sessions" with child entries, or keep everything as single events with fields
- How much of finance needs first class entities like accounts and inventory vs fields only

