# Memoato MCP Specialist Handover

Updated: 2026-08-04
Owner thread: `Memoato MCP`

## Role

This is the durable handover for the specialist that owns the technical audit of Memoato MCP, category semantics, and the `raw log -> derived facts` pipeline.

Memoato is built for Hrvoje's personal memory first and consumer SaaS later. The specialist does not own Hrvoje's personal Todoist or Daily Coach workflow.

## Required first reads

Read these completely before acting:

1. `/Users/harvey/git/Obsidian/obsidian-hills/AGENTS.md`
2. `/Users/harvey/git/Obsidian/obsidian-hills/00_SYSTEM/Codex/ORCHESTRATOR.md`
3. `/Users/harvey/git/HILLS/memoato-app/AGENTS.md`
4. `/Users/harvey/git/Obsidian/obsidian-hills/00_SYSTEM/Codex/skills/netjak-memoato-mcp/SKILL.md`
5. `/Users/harvey/git/Obsidian/obsidian-hills/00_SYSTEM/Codex/skills/netjak-memoato-product/SKILL.md`
6. `/Users/harvey/git/Obsidian/obsidian-hills/01_PROJECTS/Memoato/Product Vision.md`
7. `/Users/harvey/git/Obsidian/obsidian-hills/01_PROJECTS/Memoato/README.md`
8. `/Users/harvey/git/Obsidian/obsidian-hills/01_PROJECTS/Memoato/MCP Logging Handoff.md`
9. Repo-local docs, schema, migrations, implementation, and tests relevant to raw entries, facts/events, categories, labels, units, aliases, parser behavior, MCP/API, corrections, and reconciliation.

## Product contract

- Save the raw text durably before any AI or parser work.
- Raw text is the source of truth.
- Parsing is asynchronous.
- Facts, events, categories, and metrics are derived views and must retain provenance to the raw entry.
- Corrections update or replace derived facts without duplicating the raw entry.
- Categories are views/metrics over facts, not the primary input model.
- Unknown but meaningful entries remain visible under `Notes`; they never silently disappear.
- Do not expose or persist API keys or secrets in docs, commits, tool output, or final responses.

## Safety boundary for the first phase

The first phase is a read-only audit, evidence-backed proposal, and dry-run implementation plan.

Do not perform production category merges/deletes, mass reprocessing, deploys, migrations, or other destructive or hard-to-reverse changes without Hrvoje's explicit approval. Prefer archive semantics over destructive deletion when referenced records exist.

## Learned logging semantics to preserve

- `Zgibovi 2 2 3` means three set-level `Pull ups` facts with values `2`, `2`, and `3`, not one aggregated total of `7`.
- Hrvoje's word `nogomet` maps to the existing `Football` category. Aliases should be user-specific and learn from corrections.
- `Prvo kupanje sezone, Znjan` belongs under `Notes` if a richer semantic fact is unavailable. An unmatched life log must remain searchable.
- `89.85 kg` belongs in the Weight/body-weight metric.
- Time-only entries for Hrvoje use `Europe/Zagreb` unless explicitly overridden.
- A multidimensional workout remains one raw entry with multiple linked facts/metrics: movement duration, average heart rate, energy, pain, and context.
- Recent example: raw entry `274d5b09-bbfd-43e3-a212-4c833ef1d242` represents an Indoor Cycle on 2026-08-04 at 22:09: duration 15:21, effort 3 `Easy`, average HR 130 bpm with range 79-142, 128 active kcal, and no pain during or immediately after.

## Known taxonomy signals requiring evidence-based review

Do not assume these are duplicates before checking all references, behavior, and semantics:

- `Active kcal` versus `Active Calories Burned`.
- `Indoor Bike` with unit `kcal` versus `Stationary Cycling` as a movement.
- System `Notes` currently appearing as `NUMBER` / amount-like modeling.
- `Sleep Quality` currently carrying unit `minutes`.
- Mixed legacy and newer values for category `kind`, `type`, aggregation, goal direction, unit, and chart configuration.

## First assignment

### 1. Complete read-only inventory

Inventory all accessible Hrvoje data and related system capabilities:

- raw entries and processing states;
- derived/labeled facts and events;
- categories, slugs, canonical names, kinds, types, units, dimensions, aliases, goals, charts, and aggregation semantics;
- correction history;
- sources and provenance;
- parser/model versions and retry state if present;
- all current MCP/API read and write capabilities.

If MCP cannot read a required data class, record the exact capability gap. Do not bypass access controls.

### 2. Revisit the full model and pipeline

Audit:

- category identity and canonical naming;
- unit and dimension compatibility;
- aliases and user-specific learning;
- multidimensional entries;
- exercise set-level facts;
- `Notes` fallback;
- raw-to-derived linkage;
- asynchronous processing, retries, and dead-letter behavior;
- idempotency;
- corrections and dismissals;
- historical reprocessing;
- provenance and audit trail.

### 3. Design safe category CRUD

Propose an explicit contract for:

- create, read, update, archive, and delete;
- archive instead of destructive delete when references exist;
- merge preview/dry-run;
- reference rewiring and conflict rules;
- commit, rollback, and audit records;
- alias management;
- user-specific alias learning;
- correction/reconciliation of raw entries and derived facts without duplication;
- batch reprocessing with a versioned parser, deterministic idempotency key, generated diff, and human review.

### 4. Compare implementation with contract

Inspect the actual database schema/migrations, API, MCP server, background processing, and tests. Every material claim must include a file/line reference or read-only data evidence.

### 5. Design automatic self-maintenance

Propose how Memoato keeps its data clean without risky autonomous mutations:

- deterministic matching before AI;
- canonical identity and alias registry;
- unit/dimension validation;
- explicit confidence thresholds;
- auto-accept only for safe cases;
- suggestion/review queue for possible category merges and cleanup;
- correction history as a learning signal;
- periodic reconciliation job;
- parser/model versioning and provenance;
- observability, metrics, retries, and dead-letter recovery.

### 6. Propose the missing MCP/API surface

Cover at least:

- search/read raw entries and derived facts;
- retrieve processing state and errors;
- correct, replace, confirm, or dismiss a derived fact;
- category CRUD and archive behavior;
- merge preview, commit, and rollback;
- alias CRUD;
- reprocess/reconcile dry-run and commit;
- audit-log retrieval;
- idempotency support.

## First-turn deliverables

Produce:

1. a concise executive finding;
2. a prioritized problem/risk table with evidence;
3. target model and invariants;
4. phased implementation plan with migrations, tests, rollback, and observability;
5. decisions Hrvoje needs to make;
6. safe quick wins;
7. a precise list of data/MCP access gaps.

Write the durable result into the smallest suitable existing Memoato document or a focused new audit document under `docs/`. Do not rewrite Product Vision casually and do not implement production behavior in the first turn.

At the end, state what was actually inventoried, what could not be read, and request approval for one precisely named implementation phase.

## Coordination

- Daily Coach E02 remains the owner of personal check-ins and personal Todoist tasks.
- This specialist does not write personal Todoist.
- Do not open more threads without Hrvoje's request.
- Do not touch PLAYGRND or unrelated projects.
- Work autonomously through the audit and avoid interrupting Hrvoje with trivial questions.
