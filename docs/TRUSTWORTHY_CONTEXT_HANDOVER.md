# Trustworthy Context Handover

Use this prompt to continue the product work in a new task.

```text
Continue Memoato's transition from personal memory into a trustworthy context product.

Repo: /Users/harvey/git/HILLS/memoato-app

Read first:
- AGENTS.md
- README.md
- docs/MEMOATO_2_PRODUCT_ARCHITECTURE.md
- docs/TRUSTWORTHY_CONTEXT_PRODUCT.md
- schema.prisma

Current decision:
- Keep one Memoato product.
- memoato.com is the landing page, app.memoato.com is the unified app, and api.memoato.com is the API/MCP surface.
- The existing life-memory experience is the personal workspace, not a legacy app to remove.
- The public guide at https://guide.hills-lab.hr is research; this repo is the applied product.

Existing trust primitives:
- raw Event notes are preserved;
- normalized facts are reviewable;
- inferences are separate;
- corrections and processing runs are auditable;
- search embeddings are disposable projections;
- API keys have logging, recall, or combined scopes;
- external recall uses accepted facts and keeps raw evidence visible.

Next milestone:
Write a concrete schema and migration plan for Workspace, WorkspaceMember, SourceConnection, SourceObject, SourceVersion, Claim, ClaimEvidence, RetrievalTrace and ContextPacket. Do not apply the migration until the authorization and source-version invariants are reviewed.

Then implement one read-only vertical slice: GitHub plus one issue tracker -> versioned source records -> proposed claims -> human review -> permission-filtered context packet -> memory diff.

Guardrails:
- PostgreSQL remains canonical.
- Preserve current personal-memory behavior and data.
- Enforce permissions before ranking, reranking and synthesis.
- Never promote model output to fact without evidence and policy.
- Keep raw sources immutable; corrections create reviewed derived state.
- Add task-level evals for stale context and permission leakage.
- Keep patches small and update the product docs when a contract changes.

Before editing, inspect git status and existing local changes. Verify with focused tests, the full test suite, Wasp build checks and the Astro landing build. Do not deploy until those pass.
```
