# Memoato 2.0 — product and technical architecture

## Product contract

Memoato is a private memory layer, not another tracker.

1. The user writes what happened in their own words.
2. The original entry is stored before any interpretation starts.
3. Memoato extracts useful facts without replacing the original.
4. Uncertain readings wait for human review.
5. Views, charts and goals are projections over memory, not required input forms.
6. Recall always shows evidence and can lead back to the original words.

The product line is: **Do not track more. Remember the missing context.**

## Information architecture

### Today

The capture surface. A large raw-entry composer is the primary action. It confirms the original was saved immediately and shows background processing separately. Scheduled check-ins and useful current views can still appear below capture.

### Memory

The evidence stream. Each item shows:

- exact original text and occurrence time;
- capture source;
- processing state;
- extracted facts and their confidence;
- whether a fact came from local rules, OpenRouter or a human correction;
- keep, fix, ignore and retry controls.

Filters expose the complete stream, review queue and failed processing queue. A failure never means the original was lost.

### Recall

Evidence-first retrieval across raw entries, normalized facts and legacy category events. Natural questions are reduced to meaningful search terms, but results are not fabricated into a chat answer. When a numeric signal is clear, Memoato can show its latest value with the matching sources underneath.

### Views

Existing categories, goals, charts, routines and schedules. This preserves every current Memoato workflow while reframing categories as optional projections over memory.

### Profile

Identity, privacy, export, integrations/API keys and visible memory-processing status. OpenRouter configuration is server-owned; the UI explains when it is used without exposing secrets.

## Data ownership model

`Event(kind=NOTE)` remains the durable raw source of truth. Memoato 2.0 does not replace, rewrite or destructively migrate existing `Event` or `Category` rows.

The normalized layer is additive:

- `MemoryFact`: atomic, queryable interpretation linked to its raw event and optional derived category event;
- `MemoryProcessingRun`: durable queue/audit row for every processing attempt;
- `MemoryCorrection`: immutable before/after record for keep, fix and ignore actions;
- `MemoryAlias`: personal language learned only from explicit correction;
- `MemoryEntity` + `MemoryFactEntity`: people, places, activities and topics that can connect facts later;
- `MemoryInference`: suggestions separated from facts, with evidence IDs and review status.

Facts are rebuildable. Raw entries are not.

## Processing pipeline

```text
capture
  → transaction: raw Event + queued ProcessingRun
  → response to user (original is safe)
  → deterministic parser
  → OpenRouter only if empty, uncertain or multi-context
  → atomic transaction:
      replace derived facts/events
      preserve raw Event
      record parser/model/run result
  → accepted facts or human review queue
```

Processing is recoverable after a restart. Queued runs and stale processing leases are reclaimed from the database. Reprocessing swaps derived state in one transaction so a crash cannot leave half-deleted derived data.

## OpenRouter policy

OpenRouter is a conservative parser, not the product voice.

- Local deterministic extraction runs first.
- Clear inputs such as `89.8 kg` or `zgibovi 2 2 3` do not need an AI round trip.
- OpenRouter is used when no fact was found, confidence is low, or a longer entry appears to contain multiple facts.
- Requests have a hard timeout and model fallback.
- The prompt forbids diagnosis, judgment, advice and invented medical, financial, identity, relationship or account details.
- Provider, model, parser version and run outcome are recorded; API keys and prompts are never exposed to the client.
- AI failure changes only processing state. The original is already durable.

## Human correction contract

- **Keep** accepts a fact.
- **Fix** edits the normalized fact, sets confidence to 100% and records the before/after values.
- **Ignore** rejects the fact and removes only its derived projection, never the raw entry.
- A changed label creates or updates a personal alias so later entries understand the user's language.

Inferences must never silently become facts. They live in `MemoryInference`, reference evidence and require an explicit product rule before promotion.

## Privacy modes

### Cloud

Full raw memory, background processing, review and cross-device recall. OpenRouter may receive raw text only under the processing policy above.

### Encrypted

The existing encrypted category/note workflow remains. Encrypted content is not sent to OpenRouter. Server-side recall cannot inspect ciphertext.

### Local-only

Existing IndexedDB data stays on the device. The Memory screen explains that normalized cloud recall is unavailable instead of silently uploading or copying local data.

Moving between modes remains an explicit Profile action. Memoato never uses a redesign as permission to upload local-only data.

## Existing-data migration

1. Take a verified PostgreSQL backup before production migration.
2. Apply the additive table migration. It contains no `DROP`, `ALTER COLUMN` or update to existing rows.
3. Deploy code that can read both legacy JSON extraction and normalized facts.
4. At startup, idempotently copy already-stored extraction JSON into `MemoryFact`. This backfill does not modify events or categories.
5. Keep legacy category sessions live as Views and include orphan legacy sessions in Recall.
6. Monitor failed processing runs and compare raw-event counts before and after deploy.

Rollback is code-first: the previous release can run against the expanded schema because all old tables and columns are unchanged. New tables remain inert until a later, separately approved cleanup.

## Product cases covered

- one-line metrics and exercise sets;
- free-form notes and mixed-context daily logs;
- feelings/context without unsafe diagnosis;
- manual category logging and existing charts/goals;
- scheduled check-ins;
- MCP/API/automation capture with revocable raw-write keys;
- low-confidence review and correction learning;
- OpenRouter outage, timeout and server restart;
- legacy entries that predate normalized memory;
- encrypted and local-only users;
- full data export including raw events, JSON payloads and the normalized memory layer.

## Next bounded extensions

The schema intentionally supports but the current UI does not yet pretend to solve:

- evidence-backed relationship/entity pages;
- suggested patterns over time;
- calendar, health and message context adapters;
- semantic/vector recall;
- user-approved inference promotion.

Each extension must keep the same invariant: evidence remains inspectable, inference remains labeled, and raw memory remains owned by the user.
