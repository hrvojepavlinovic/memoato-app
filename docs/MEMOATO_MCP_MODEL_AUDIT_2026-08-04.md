# Memoato MCP, taxonomy, and raw-to-facts audit

Date: 2026-08-04

Scope: read-only production/data audit plus repository implementation review
Safety: no production/data/deploy mutation was performed

## Executive finding

Memoato already preserves a durable raw `Event(kind=NOTE)`, records normalized facts and processing runs, creates linked derived sessions, supports fact accept/reject/edit in the authenticated app, and has recoverable queued/stale processing. The foundation is substantially closer to the product contract than the older backlog suggests.

The unsafe gap is the control plane around that foundation. Category identity has no explicit dimension contract; parsing can accept overlapping client, deterministic, catalog, and AI facts; category deletion still hard-deletes its events; and neither MCP nor the external API exposes fact review, processing/audit reads, category archive/merge, alias management, or dry-run reconciliation. Production evidence already shows the consequence: raw entry `274d5b09-bbfd-43e3-a212-4c833ef1d242` has seven accepted facts, including two cycling interpretations and two representations of the same 128 active kcal.

The next implementation should therefore establish taxonomy and reconciliation safety before any category cleanup or batch reprocessing.

## Actual inventory coverage

### Production data read directly in a read-only transaction

The target user was resolved by the known category `focus_cat_87` (`Active kcal`), without printing user identity or credentials.

| Data class | Coverage on 2026-08-04 | Result |
| --- | --- | --- |
| Categories | Complete row-level metadata for all current categories | 23 active, 0 archived |
| Raw entries | Complete aggregate inventory and processing-state distribution | 45 `NOTE`: 22 complete, 23 with legacy/missing status |
| Events | Complete aggregate inventory by kind/source | 1,114 `SESSION`; 63 identified as derived by `data.rawEntryId` |
| Normalized facts | Complete aggregate inventory by status/kind; focused row-level check of the supplied recent raw entry | 136 facts: 134 accepted, 1 needs review, 1 rejected |
| Processing runs | Complete aggregate inventory and parser/provider/model distribution | 19 runs, all complete, all attempt 1, no recorded error |
| Corrections | Complete row-level inventory | 2: one accept and one reject |
| Personal aliases | Complete row-level inventory | 0 |
| Concepts / concept aliases | Complete counts | 52 concepts, 133 concept aliases |
| Entities / inferences | Complete counts | 0 entities, 0 inferences |
| Entry embeddings | Complete count | 73 |
| Sources/provenance | Complete event counts by source and kind | Sources include `focus`, `memoato`, `mcp`, `codex`, `app`, `obsidian-training-log`, and smoke-test sources |

The known Indoor Cycle entry is complete and has seven facts and four derived sessions. Its accepted facts are: Stationary Cycling (15.35 min), Average Heart Rate (130 bpm), Energy (128 kcal, uncategorized), Indoor bike (categorized as `Indoor Bike`), Active Calories Burned (128 kcal), Pain (0), and Padel context. This verifies multidimensional linkage, but also verifies overlapping fact acceptance and ambiguous category projection.

### MCP inventory

The installed key exposes exactly three tools in this session:

1. `memoato_logging_guide`;
2. `memoato_list_categories`;
3. `memoato_create_entry`.

`memoato_list_categories(take=150)` returned all 23 active categories. The repository defines six MCP tools, but scope filtering exposes search and summary only to `memory:read`, and context packet building only to its context scope (`src/memory/mcp.ts:64-203`, `src/memory/mcpCapabilities.ts:7-32`). This session's key therefore has logging scope only.

### Repository inventory

Reviewed the schema, relevant migrations, category actions/queries, raw ingest and processing, deterministic/catalog/OpenRouter extraction, MCP/API routes and scope filtering, correction/retry operations, memory search/summary behavior, startup recovery/backfills, architecture/product docs, and the relevant memory tests.

## Prioritized problems and risks

| Priority | Problem / risk | Evidence | Consequence |
| --- | --- | --- | --- |
| P0 | Overlapping parser outputs are deduplicated by concept/value shape, not semantic equivalence across concepts/categories. | Merge order accepts client + deterministic + catalog + AI (`src/memory/ingest.ts:741-763`); final dedupe key is concept, amount, unit, set index/value (`src/memory/labeling.ts:383-427`). Production Indoor Cycle has duplicate cycling and 128-kcal meanings. | Double projections and misleading analytics; unsafe reprocessing amplifies drift. |
| P0 | Category delete is destructive and has no reference preview. | It deletes all category events and then the category (`src/focus/actions.ts:718-745`). `MemoryFact.categoryId` becomes null, while derived-event deletions erase chart history (`schema.prisma:183-187`). | Irrecoverable history loss and orphaned fact/category semantics. |
| P0 | Category identity and dimensions are free-form and internally inconsistent. | `type`, `kind`, `unit`, chart and aggregation fields are nullable strings (`schema.prisma:61-94`). Production includes `Sleep Quality/minutes`, system `Notes` as `NUMBER/amount/sum`, movement categories as `NUMBER`, `Indoor Bike/kcal`, and `Stationary Cycling/no unit`. | Invalid aggregation, accidental category creation, and ambiguous merge decisions. |
| P0 | No safe category merge/archive/reconciliation API exists. | App only implements create/update/hard-delete (`src/focus/actions.ts:419-745`); MCP only defines logging, category listing, search, summary, and context packet tools (`src/memory/mcp.ts:64-203`). | Taxonomy cannot be repaired safely or audited through agent workflows. |
| P1 | Raw processing is durable but execution is an in-process background tick, not a leased worker/dead-letter system. | Capture transaction creates raw + queued run (`src/memory/ingest.ts:1022-1071`); processing is launched with `setTimeout` (`src/memory/ingest.ts:1008-1018`); startup reclaims up to 50 queued/stale runs (`src/memory/ingest.ts:1122-1150`). | Recovery depends on process startup and repeated generic failure; no dead-letter reason/detail or bounded retry policy. |
| P1 | Reprocessing replaces derived state atomically but has no preview/diff and can erase human review state. | It deletes facts, entry concepts, and linked sessions before rebuilding inside a transaction (`src/memory/ingest.ts:773-903`). Processing runs store only counts as result (`src/memory/ingest.ts:954-968`). | A new parser version can silently change accepted facts or undo corrections at scale. |
| P1 | Personal alias learning exists but is too narrow and currently unused in production. | Alias is created only when an edit changes `before.label` (`src/memory/operations.ts:833-859`); production `MemoryAlias` count is 0 despite known `nogomet -> Football` semantics. | Corrections do not reliably become deterministic user-specific matching. |
| P1 | MCP category read omits important category semantics. | Selection/response omits goal values, rollup flag, schedule, source, archive timestamp, and reference counts (`src/memory/mcp.ts:223-277`). | Clients cannot validate full category behavior or safely propose updates/merges. |
| P1 | External search is bounded by a 5,000-event scan and exposes accepted facts only. | Search loads a bounded event set and filters in application code (`src/memory/query.ts:303-339`); accepted fact trust boundary is explicit (`src/memory/query.ts:139-157`). | Recall is intentionally safe, but it is not an administrative inventory/audit endpoint and can become incomplete at higher volume. |
| P2 | Legacy and normalized coverage is mixed. | Production has 45 raw notes, 22 complete statuses, 19 processing runs, and 136 normalized facts; compatibility backfill copies legacy extraction without changing raw/category rows (`src/memory/ingest.ts:1153-1159`). | “Processed,” “normalized,” and “searchable” are not currently one measurable coverage definition. |
| P2 | Correction audit is present but not immutable at the database layer and is not externally readable. | `MemoryCorrection` has before/after/action but no actor type, request/idempotency key, parser baseline, or rollback relation (`schema.prisma:351-371`). | Weak operational forensics and no safe automated rollback contract. |

## Target model and invariants

### Identity layers

- `RawEntry`: immutable original evidence. Editing raw text should become a revision/correction record, not silent source replacement.
- `Fact`: atomic interpretation with stable ID, status, confidence, parser/model provenance, evidence span, and raw-entry revision.
- `Concept`: language-neutral meaning (`movement.stationary_cycling`, `energy.active_kcal`).
- `Category`: user-facing metric/view over compatible concepts and dimensions. It is not canonical meaning by itself.
- `Alias`: user-scoped phrase -> concept/category candidate, with source, confidence, and correction evidence.
- `Projection`: rebuildable category event or search embedding, carrying parser version and deterministic generation key.

### Required invariants

1. Raw text is durably committed before processing and is never deleted by category operations.
2. Every derived fact/event identifies raw entry, raw revision, parser version, and generation key.
3. Reprocessing is idempotent for `(rawEntryId, rawRevision, parserVersion, projectionType, semanticFingerprint)`.
4. A semantic fact is accepted once even if client, deterministic parser, catalog, and AI all propose it; provenance may list multiple agreeing producers.
5. One raw entry may have many dimensions. Duration, heart rate, energy, pain, effort, and context remain separate linked facts.
6. Set lists remain set-level facts/projections. `Zgibovi 2 2 3` preserves `2,2,3`; totals are derived aggregations, not replacements.
7. Category compatibility is validated by `dimension + unit family + fact kind + aggregation`, not title similarity.
8. Unknown meaningful input has an accepted `personal.note` fact and visible Notes projection.
9. Human rejection/edit always dominates later parser output unless explicitly reset in a reviewed reconciliation.
10. Referenced categories are archived by default. Hard delete is allowed only for unreferenced, never-used categories and still emits an audit record.
11. Merge is previewed, reviewed, committed transactionally, and reversible.
12. No autonomous taxonomy mutation crosses a confidence threshold without a generated diff and audit record.

## Safe category CRUD and merge contract

### Create

- Require canonical display name, stable slug, fact kind, dimension, canonical unit (or explicitly unitless), aggregation, chart semantics, and source.
- Return deterministic conflict candidates by normalized name, alias, concept, and compatible dimension.
- Support `dryRun=true`; commit requires an idempotency key.

### Read

- Return full metadata plus active/archive state, aliases, concept links, raw/fact/event reference counts, date span, and compatibility warnings.
- Separate user-facing category fields from canonical dimension metadata.

### Update

- Metadata-only updates are allowed directly when semantics do not change.
- Dimension, unit family, kind, or aggregation changes require preview showing affected facts/events/charts.
- Persist before/after audit and optimistic version.

### Archive and delete

- `archive` hides the category from new matching and normal UI while retaining references and recall.
- `delete` rejects system categories and any category with references. Only an unreferenced category may be hard-deleted.
- Existing hard-delete behavior must be replaced before taxonomy cleanup.

### Merge preview / commit / rollback

- Preview returns source/target metadata, compatibility decision, all reference counts, alias collisions, event/fact rewires, duplicate semantic projections, chart/goal conflicts, and proposed resolutions.
- Commit locks both categories, verifies preview version/hash, rewires compatible facts/events/concepts/aliases, archives the source, records every change, and never edits raw entries.
- Conflict rules: incompatible dimensions block; convertible units require explicit conversion; chart/goal settings never auto-win; duplicate projections collapse only when semantic fingerprint and raw provenance agree.
- Rollback uses the merge audit's row map to restore references and source state, provided no later conflicting category mutation occurred.

### Alias and learning

- Alias CRUD is user-scoped and concept-first, with optional category projection.
- An explicit correction can propose an alias. Auto-activation is safe only after exact deterministic normalization and a unique compatible target; otherwise queue for review.
- Store correction ID and observed phrase; do not infer aliases from rejected or merely AI-generated labels.

### Reprocessing and reconciliation

- Dry-run against a pinned parser/model version writes no facts/events; it returns added/removed/changed/unchanged facts, category changes, confidence changes, and preserved human overrides.
- Commit requires the dry-run hash, parser version, bounded entry set, idempotency key, and reviewer identity.
- Process batches with checkpoints and stop thresholds. Never mass-reprocess directly from a merge action.

## Automatic self-maintenance design

1. Normalize phrase, concept, dimension, and unit before matching.
2. Run deterministic exact alias/concept/category matching first.
3. Merge equivalent producer candidates into one fact with multi-producer provenance.
4. Validate unit/dimension and category projection before acceptance.
5. Auto-accept only unique, compatible deterministic matches or exact client category IDs with matching dimensions.
6. Put ambiguous categories, possible merges, incompatible units, and duplicate semantic facts in a review queue.
7. Use accepted corrections as scoped learning signals; preserve rejects as negative constraints.
8. Run periodic read-only reconciliation that emits findings/diffs. A separate approved commit action applies them.
9. Track processing age, attempts, error code, parser/model mix, accepted/review/rejected counts, Notes fallback rate, category-creation rate, duplicate-candidate rate, and projection coverage.
10. Move extraction to a durable leased worker with bounded retries and explicit dead-letter state/recovery action.

## Missing MCP/API surface

Proposed tools/endpoints, separated into read/preview and commit scopes:

- `memory.list_raw_entries`, `memory.get_raw_entry` including revision, processing state, errors, runs, facts, and derived projections;
- `memory.list_facts`, `memory.get_fact` with all provenance/evidence;
- `memory.review_fact` (`confirm`, `edit`, `dismiss`, `replace`) with idempotency key;
- `category.list/get` with full metadata and reference diagnostics;
- `category.create/update/archive/delete` with dry-run and optimistic version;
- `category.merge_preview`, `category.merge_commit`, `category.merge_rollback`;
- `alias.list/create/update/archive/delete`;
- `reconcile.preview`, `reconcile.commit`;
- `reprocess.preview`, `reprocess.commit`, `reprocess.status`, `reprocess.cancel`;
- `audit.list/get` across corrections, taxonomy changes, merges, and reprocessing;
- all commit calls require scoped write permission and idempotency key; preview/read calls require dedicated audit/read scope.

## Phased implementation plan

### Phase 1 — Taxonomy Safety Foundation

This is the recommended next phase.

- Add category archive/status/version and explicit dimension/unit-family metadata.
- Add taxonomy audit and merge-operation tables with preview hash and reversible row map.
- Replace hard delete with archive-by-default and unreferenced-only delete.
- Add a pure compatibility validator and read-only category diagnostics/merge-preview service.
- Add duplicate semantic-fact detection to preview only; do not rewrite production facts.
- Tests: schema constraints, unit compatibility, reference detection, archive visibility, hard-delete rejection, deterministic merge preview, concurrent version conflict, rollback plan generation.
- Rollback: deploy previous code while additive tables/columns remain inert; archive action is reversible; no existing data is rewritten in this phase.
- Observability: preview counts, blocked incompatibilities, archived categories, attempted forbidden deletes, duplicate candidates.

### Phase 2 — Fact Review and Audit API/MCP

- Expose raw/fact/processing/audit reads and scoped review actions.
- Add request actor, idempotency key, parser baseline, and human-override persistence.
- Tests cover scope isolation, replay safety, raw immutability, and correction precedence.

### Phase 3 — Reconciliation Dry-run

- Introduce semantic fingerprints across producer outputs, versioned parser bundles, generated diffs, and review queue.
- Run read-only reconciliation over selected entries, starting with the Indoor Cycle example and known legacy logging cases.
- No production fact/category rewrite in this phase.

### Phase 4 — Reviewed Commit and Durable Worker

- Add bounded batch commit/rollback, leased worker, retry policy, dead-letter state, checkpoints, and stop thresholds.
- Canary a tiny explicitly approved entry set before historical batches.

### Phase 5 — Taxonomy Cleanup

- Only after previews and rollback are proven, review `Active kcal` vs `Active Calories Burned`, `Indoor Bike` vs `Stationary Cycling`, Notes semantics, Sleep Quality unit, and other legacy/new category drift.
- No duplicate assumption is made in advance; each change uses evidence and a reviewed preview.

## Safe quick wins

- Change stale backlog wording: durable `MemoryProcessingRun` recovery now exists, although execution is still an in-process tick and lacks dead-letter policy.
- Add tests for the supplied Indoor Cycle entry proving semantic duplicate detection without changing current production output.
- Add read-only internal diagnostics for category reference counts and unit/dimension warnings.
- Expose existing processing/fact/correction reads behind a new least-privilege audit scope before adding writes.
- Add a test that category delete is refused when events, facts, concepts, or aliases reference it; implementation belongs in Phase 1.

## Decisions needed from Hrvoje

1. Confirm categories are user-facing projections over stable concepts/dimensions, rather than the canonical fact identity.
2. Confirm raw-entry edits should become revisioned source history instead of replacing `rawText` in place (`src/memory/operations.ts:891-961`).
3. Confirm archived categories remain searchable and visible in historical views but are excluded from new automatic matching.
4. Confirm human fact edits/rejections persist as overrides across parser-version reprocessing.
5. Choose whether unit conversion is initially blocked entirely or limited to a small explicit conversion registry. Recommended first phase: block incompatible/different-unit merges; add conversion later.

## Precise access gaps

- The active MCP key cannot call the repository-defined `memoato_search_entries` or `memoato_summarize_metric`; it lacks `memory:read` exposure in this session.
- MCP has no tools at all for raw-entry listing/get, processing runs/errors, fact listing/get, corrections, aliases, entities, inferences, embeddings, audit records, category create/update/archive/delete, merge, reconcile, or reprocess.
- The external HTTP API only offers raw write, memory search, and metric summary (`src/memory/routes.ts:37-108`); it has the same administrative gaps.
- `memoato_list_categories` omits category goals, rollup, scheduling, source/archive timestamps, dimensions, aliases, and reference counts (`src/memory/mcp.ts:223-277`).
- Production row-level raw text was intentionally not bulk-exported into this audit document. Counts/statuses and the explicitly supplied raw-entry ID were inspected; this avoids copying private life logs into Git/docs.
- Embedding vectors and API credentials were not read or printed. Only embedding counts/status metadata were in scope.
- No external provider logs, OpenRouter request traces, or historical process stdout/stderr were available through MCP/API or required to establish the findings.

## Approval gate

Requested approval: **Phase 1 — Taxonomy Safety Foundation**.

This phase is precisely limited to additive taxonomy safety schema, archive-by-default category behavior, unreferenced-only delete, compatibility validation, read-only diagnostics/merge preview, tests, and observability. It excludes production category merges, historical reprocessing, data cleanup, deploy, and migration execution.
