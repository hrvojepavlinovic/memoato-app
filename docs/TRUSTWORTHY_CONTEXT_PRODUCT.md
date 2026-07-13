# Trustworthy Context Product Direction

## Decision

Memoato will remain one product.

- `memoato.com` explains the product.
- `app.memoato.com` hosts the app.
- `api.memoato.com` exposes scoped API and MCP access.
- The current life-memory experience becomes the personal workspace.
- Team and project context are added as new workspace types when their trust boundaries are ready.

Do not split the current app onto a separate `life` subdomain. That would create two products before there are two proven workflows.

## Product contract

Memoato should give an agent context that is:

- traceable to raw evidence;
- separated from derived facts and inferences;
- scoped to a user, workspace and source permission;
- current enough for the task;
- reviewable and correctable by a human;
- observable through a retrieval trace;
- portable across model and agent tools.

The model is replaceable. The context contract is the product.

## What already exists

The current schema and product already provide useful primitives:

- `Event(kind=NOTE)` preserves the raw source;
- `MemoryFact` stores a reviewable interpretation;
- `MemoryProcessingRun` records processing attempts;
- `MemoryCorrection` records human changes;
- `MemoryInference` separates conclusions from facts;
- `MemoryEmbedding` is a rebuildable search projection;
- Recall returns evidence before synthesis;
- API keys can be limited to logging, recall, or both.

These are the right foundations. They are not yet a complete team context layer.

## Missing primitives

Before ingesting company systems, Memoato needs explicit models for:

- workspace membership and roles;
- source connections and source-specific permissions;
- immutable source objects and versions;
- claims supported by one or more evidence records;
- supersession, contradiction and source precedence;
- freshness and revalidation policy;
- retrieval traces and context packets;
- permission snapshots used at retrieval time.

Do not encode these as loose tags on personal memory rows. Authorization must be structural and enforced before ranking or synthesis.

## First milestone

Build one narrow team context workflow:

1. Connect one GitHub organization and one issue tracker.
2. Preserve imported source objects and versions without rewriting them.
3. Propose claims with direct evidence links.
4. Require review before claims become durable context.
5. Retrieve only records allowed for the requesting identity.
6. Return a context packet with claims, evidence, freshness and exclusions.
7. Produce a memory diff after relevant source changes.
8. Run permission-leakage and stale-context evals before adding write actions.

The first useful output is a trusted read-side context packet for coding agents. Autonomous writes are not part of this milestone.

## Relationship to the guide

[Trustworthy Agent Memory and Context](https://guide.hills-lab.hr) is the public research and design reference. Memoato is the applied product. HILLS Lab maintains the guide and can use the same methods for implementation and advisory work, but product behavior must be documented in this repository.

## Non-goals

- replacing PostgreSQL with an AI-native database without a measured need;
- building a generic vector search wrapper;
- copying every connected tool into one undifferentiated index;
- treating model output as canonical truth;
- exposing private context to a model and filtering it afterward;
- launching a second app before the workspace and permission model exists.
