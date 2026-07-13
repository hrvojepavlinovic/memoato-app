# Trustworthy context schema and migration plan

Status: **design review required; migration must not be applied**.

This plan turns the existing personal-memory product into the first workspace of one Memoato product. It is additive: `Event`, `MemoryFact`, personal Recall, categories and existing API/MCP behavior remain unchanged.

## First vertical slice

The first team/project workflow is deliberately read-only toward connected systems:

```text
GitHub organization (selected repositories) + Linear team
  → immutable source objects and source versions
  → deterministic proposed claims with direct evidence
  → owner/admin review
  → permission-filtered context packet for a person or agent
  → deterministic diff from the previous packet
```

GitHub and Linear credentials are never stored in source rows. The initial adapter accepts only allowlisted server-side credential references. OAuth and encrypted per-connection secrets are a later operational milestone.

## Authorization model

Authorization is structural and deny-by-default.

1. `WorkspaceMember` proves that a user is an active member of a workspace.
2. `SourceConnectionAccess` proves that the member may read a connection.
3. `SourceObjectAccess` proves that the member may read a specific repository/team object.
4. Retrieval builds the complete allowed `SourceVersion` ID set from those active grants.
5. A claim is eligible only when it is accepted, fresh and **every** evidence version is in that allowed set.
6. Only after that filter may Memoato rank, rerank or send context to a model.

Connection access is not sufficient on its own. GitHub organization members can have different repository access, and Linear teams can have different visibility. Object grants are materialized from the upstream permission snapshot during sync. A revoked connection or object grant invalidates future packets immediately.

Each membership and connection carries a monotonic permission version. `RetrievalTrace` stores the exact versions, allowed-source hash and policy version used for one request. A packet is not reusable if the current permission fingerprint differs from its trace.

### Roles

| Role   | Read allowed objects | Build packets | Review claims | Manage sources/members |
| ------ | -------------------- | ------------- | ------------- | ---------------------- |
| owner  | yes                  | yes           | yes           | yes                    |
| admin  | yes                  | yes           | yes           | yes                    |
| member | yes                  | yes           | no            | no                     |
| viewer | yes                  | yes           | no            | no                     |

Suspended or removed members have no access regardless of retained grant rows.

## Core models

### `Workspace`

The authorization and retention boundary. `type=personal` is the existing personal-memory workspace; `team` and `project` enable connected context without creating another product.

Key fields: stable slug, type, status, optional creator, timestamps.

### `WorkspaceMember`

One user/role inside one workspace. The unique `(workspaceId, userId)` row is the requester identity used by all context operations. `permissionVersion` increments whenever role or status changes.

### `SourceConnection`

One read-only upstream account boundary, currently `github` or `linear`. It stores external account identity, non-secret configuration, an allowlisted credential reference, sync cursor/status and a permission version. It never stores a token.

### `SourceConnectionAccess`

An explicit per-member connection grant. New team members receive no source access automatically. Sync refuses to ingest for a requester without an active read grant.

### `SourceObject`

Stable upstream identity such as `github:org/repo:pull:42` or `linear:team:issue-id`. Identity and lifecycle metadata may advance; raw content does not live here.

### `SourceObjectAccess`

An explicit read grant for one member and one source object, tied to the connection and connection-access permission epochs that produced it. Retrieval requires active connection/object grants and exact epoch matches; stale materialized grants fail closed before ranking.

### `SourceVersion`

Append-only raw evidence. Each changed upstream payload produces a new row with a content hash, source timestamp, normalized search text and optional predecessor. Equal content hashes are idempotent. Application code never updates or deletes these rows; the migration adds a database trigger that rejects mutation.

### `Claim`

A proposition derived from evidence. New connector output starts as `proposed`; only a human owner/admin can set `accepted` or `rejected`. A changed upstream fact creates a new claim that can supersede an old one rather than rewriting it. Model output can propose claims but cannot accept them.

### `ClaimEvidence`

An immutable edge from a claim to one exact source version, with `supports`, `contradicts` or `supersedes` role and a field/line locator. An accepted claim must have at least one supporting edge. If any evidence becomes inaccessible, the whole claim is excluded before ranking.

### `RetrievalTrace`

Audit record for one packet request: requester member, normalized query/hash, permission snapshot/hash, policy version, filter/ranking stages and exclusion counts. It exists even if no claim is returned.

### `ContextPacket`

Immutable, model-neutral read result linked one-to-one to its trace. It contains selected accepted claims, visible evidence metadata, freshness, exclusions and a deterministic packet hash. It may point to the previous comparable packet and stores a deterministic memory diff.

### `ContextPacketClaim`

Ordered join between packet and claims. This prevents packet membership from existing only inside opaque JSON and makes audits/revalidation possible.

## Source versioning invariants

- `SourceVersion.contentHash` is SHA-256 over canonical JSON, not provider `updatedAt`.
- `(sourceObjectId, contentHash)` is unique, making retries idempotent.
- `ordinal` increases per object inside the ingestion transaction.
- `previousVersionId`, when present, must reference the same `SourceObject`.
- Provider timestamps are evidence metadata; ingestion time remains separate.
- A missing upstream object is marked on `SourceObject` only after a complete successful sync. Historical versions remain.
- Normalized text is rebuildable; the raw JSON payload remains canonical evidence.

## Claim/evidence invariants

- Proposed/accepted claim semantics are immutable; source changes produce a new claim.
- `accepted` requires at least one `supports` evidence edge and reviewer metadata.
- The database verifies that an accepting reviewer is an active workspace owner/admin; terminal review metadata and claim-state transitions are one-way.
- Evidence edges are append-only and reference one exact source version.
- `supersedesClaimId`, when present, must remain inside the same workspace and claim key.
- Rejected, superseded, stale or unreviewed claims never enter a packet.
- Deterministic connector claims identify their policy version. Model-proposed claims additionally identify provider/model/prompt version.

## Permission propagation invariants

- Workspace membership alone reveals no connected source.
- A connection grant never implies all object grants.
- New objects inherit only grants observed or explicitly approved during the same permission sync.
- Grant revocation increments permission versions before any later retrieval.
- Materialized object grants record both the connection and connection-access epochs; mismatches are denied before evidence IDs enter the candidate set.
- Packet construction resolves permissions once, hashes the snapshot, filters evidence, and then ranks.
- Synthesis may receive only the already-filtered packet payload.
- Requester-visible packet/trace metadata never counts inaccessible claims, avoiding an authorization side channel.
- Packet reads revalidate the permission fingerprint; stale packets are audit records, not reusable answers.

## Context packet and memory diff

For the first slice, ranking is deterministic lexical scoring over already-authorized accepted claims. A later vector/reranker stage must consume the same filtered candidate set.

The packet diff compares the new packet with the latest packet for the same workspace, member, policy version and query hash. The query hash includes the normalized query and requested result limit:

- `added`: accepted claim IDs newly present;
- `removed`: previously visible claims no longer present, including permission/freshness removal without exposing hidden content;
- `changed`: stable claim keys whose accepted claim ID changed through supersession;
- `unchanged`: count only.

Removed entries expose IDs/keys only if they were visible in the previous authorized packet. No newly denied statement or evidence is copied into the diff.

## Migration phases

### Phase 0 — review gate (current)

- Review authorization, permission propagation, source versioning and claim-evidence invariants.
- Run schema validation and unit/eval tests only.
- Do **not** run `prisma migrate deploy`, `wasp db migrate-dev` or production deployment.

### Phase 1 — additive schema

- Take and verify a PostgreSQL backup.
- Create the new tables, indexes, foreign keys and immutable-source triggers.
- Add no foreign key from existing personal-memory rows and update no existing data.
- Deploy code with the Context UI feature-gated off until a workspace exists.

### Phase 2 — personal workspace bootstrap

- Create one `personal` workspace and owner membership per existing user in an idempotent backfill.
- Do not move or rewrite `Event`, `MemoryFact`, `Category` or embeddings.
- Personal Recall continues using `userId`; a later reviewed migration may attach those rows to the personal workspace.

### Phase 3 — controlled connector pilot

- Create one team/project workspace.
- Configure one GitHub organization with an explicit repository allowlist and one Linear team.
- Use server-side read-only credential references; verify upstream and materialized object grants.
- Sync a bounded page, review claims manually and run leakage/freshness evals before enabling API/MCP packet access.

### Rollback

The migration is additive. The previous app ignores the new tables. Rollback switches code first; context rows remain inert and must not be dropped until a separately reviewed retention/export procedure exists.

## Review checklist before applying migration

Pilot review completed 2026-07-13. Any multi-member mutation surface requires a new review.

- [x] Workspaces are single-owner in the pilot; there are no invite, role, transfer or workspace-delete endpoints.
- [x] Verified account deletion purges solo-owned context inside an explicit database purge boundary and blocks deletion when a shared membership exists.
- [x] GitHub access is an explicit repository allowlist and Linear access is an explicit team connection grant; neither implies workspace-wide visibility.
- [x] Retrieval re-reads active membership and rejects stale connection/access permission epochs before collecting evidence IDs.
- [x] Retrieval requires every evidence version to be authorized before ranking.
- [x] SourceVersion and ClaimEvidence are immutable outside the verified account-deletion purge boundary.
- [x] Claim acceptance requires supporting evidence and an active owner/admin reviewer at the database boundary.
- [x] Packet, trace, previous-packet and packet-claim workspace boundaries are enforced by database guards.
- [x] Supersession is append-only and accepted claims expire through explicit freshness timestamps.
- [x] The API/MCP always builds a fresh packet; no endpoint reuses a stored packet as current context. Memory diffs expose only previously visible IDs/keys.
- [x] Permission-leakage, stale-context and stale-grant epoch evals pass.

## Provider notes

- GitHub REST requests use versioned read endpoints and explicit repository selection; organization membership is not treated as proof of repository visibility.
- Linear uses its GraphQL read API, cursor pagination ordered by `updatedAt`, and checks GraphQL `errors` even when HTTP status is 200.
- Production multi-user connections should use OAuth. Personal API keys/server env references are pilot-only and remain outside database payloads.

Official references:

- [GitHub REST repositories](https://docs.github.com/en/rest/repos/repos)
- [GitHub REST pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [Linear GraphQL getting started](https://linear.app/developers/graphql)
- [Linear pagination](https://linear.app/developers/pagination)
