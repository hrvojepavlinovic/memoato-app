-- DRAFT ONLY: do not apply until docs/TRUSTWORTHY_CONTEXT_SCHEMA_PLAN.md
-- authorization, permission propagation, source versioning and claim/evidence
-- invariants have been reviewed. This migration is additive and does not touch
-- existing personal-memory rows.

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "policyVersion" TEXT NOT NULL DEFAULT 'context-policy-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissionVersion" INTEGER NOT NULL DEFAULT 1,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "syncCursor" JSONB,
    "permissionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnectionAccess" (
    "id" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "upstreamPrincipal" JSONB,
    "permissionVersion" INTEGER NOT NULL DEFAULT 1,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConnectionAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObject" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "upstreamScope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObjectAccess" (
    "id" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceConnectionAccessId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "sourcePermissionVersion" INTEGER NOT NULL,
    "connectionPermissionVersion" INTEGER NOT NULL,
    "connectionAccessPermissionVersion" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceObjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "previousVersionId" TEXT,
    "ordinal" INTEGER NOT NULL,
    "externalVersion" TEXT,
    "contentHash" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reviewedByMemberId" TEXT,
    "supersedesClaimId" TEXT,
    "claimKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "proposerType" TEXT NOT NULL DEFAULT 'deterministic',
    "proposerRef" TEXT,
    "policyVersion" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "freshUntil" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'supports',
    "locator" JSONB,
    "excerpt" TEXT,
    "excerptHash" TEXT,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalTrace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requesterMemberId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "permissionSnapshot" JSONB NOT NULL,
    "permissionSnapshotHash" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "includedCount" INTEGER NOT NULL DEFAULT 0,
    "permissionExcludedCount" INTEGER NOT NULL DEFAULT 0,
    "staleExcludedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextPacket" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requesterMemberId" TEXT NOT NULL,
    "retrievalTraceId" TEXT NOT NULL,
    "previousPacketId" TEXT,
    "queryHash" TEXT NOT NULL,
    "permissionSnapshotHash" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "diff" JSONB NOT NULL,
    "packetHash" TEXT NOT NULL,
    "freshUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextPacketClaim" (
    "contextPacketId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ContextPacketClaim_pkey" PRIMARY KEY ("contextPacketId","claimId")
);

-- CreateIndex
CREATE INDEX "Workspace_type_status_idx" ON "Workspace"("type", "status");

-- CreateIndex
CREATE INDEX "Workspace_creatorId_idx" ON "Workspace"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_status_idx" ON "WorkspaceMember"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_role_status_idx" ON "WorkspaceMember"("workspaceId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "SourceConnection_workspaceId_status_idx" ON "SourceConnection"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "SourceConnection_provider_status_idx" ON "SourceConnection"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConnection_workspaceId_provider_externalAccountId_key" ON "SourceConnection"("workspaceId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "SourceConnectionAccess_workspaceMemberId_permission_revoked_idx" ON "SourceConnectionAccess"("workspaceMemberId", "permission", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConnectionAccess_sourceConnectionId_workspaceMemberId_key" ON "SourceConnectionAccess"("sourceConnectionId", "workspaceMemberId");

-- CreateIndex
CREATE INDEX "SourceObject_workspaceId_provider_objectType_idx" ON "SourceObject"("workspaceId", "provider", "objectType");

-- CreateIndex
CREATE INDEX "SourceObject_sourceConnectionId_status_idx" ON "SourceObject"("sourceConnectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObject_sourceConnectionId_objectType_externalId_key" ON "SourceObject"("sourceConnectionId", "objectType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObject_workspaceId_stableKey_key" ON "SourceObject"("workspaceId", "stableKey");

-- CreateIndex
CREATE INDEX "SourceObjectAccess_workspaceMemberId_permission_revokedAt_idx" ON "SourceObjectAccess"("workspaceMemberId", "permission", "revokedAt");

-- CreateIndex
CREATE INDEX "SourceObjectAccess_sourceConnectionAccessId_idx" ON "SourceObjectAccess"("sourceConnectionAccessId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObjectAccess_sourceObjectId_workspaceMemberId_key" ON "SourceObjectAccess"("sourceObjectId", "workspaceMemberId");

-- CreateIndex
CREATE INDEX "SourceVersion_workspaceId_ingestedAt_idx" ON "SourceVersion"("workspaceId", "ingestedAt");

-- CreateIndex
CREATE INDEX "SourceVersion_sourceObjectId_sourceUpdatedAt_idx" ON "SourceVersion"("sourceObjectId", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "SourceVersion_previousVersionId_idx" ON "SourceVersion"("previousVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersion_sourceObjectId_ordinal_key" ON "SourceVersion"("sourceObjectId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersion_sourceObjectId_contentHash_key" ON "SourceVersion"("sourceObjectId", "contentHash");

-- CreateIndex
CREATE INDEX "Claim_workspaceId_status_freshUntil_idx" ON "Claim"("workspaceId", "status", "freshUntil");

-- CreateIndex
CREATE INDEX "Claim_workspaceId_claimKey_createdAt_idx" ON "Claim"("workspaceId", "claimKey", "createdAt");

-- CreateIndex
CREATE INDEX "Claim_reviewedByMemberId_idx" ON "Claim"("reviewedByMemberId");

-- CreateIndex
CREATE INDEX "Claim_supersedesClaimId_idx" ON "Claim"("supersedesClaimId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_sourceVersionId_idx" ON "ClaimEvidence"("sourceVersionId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_claimId_role_idx" ON "ClaimEvidence"("claimId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEvidence_claimId_sourceVersionId_role_key" ON "ClaimEvidence"("claimId", "sourceVersionId", "role");

-- CreateIndex
CREATE INDEX "RetrievalTrace_workspaceId_requesterMemberId_createdAt_idx" ON "RetrievalTrace"("workspaceId", "requesterMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalTrace_workspaceId_queryHash_createdAt_idx" ON "RetrievalTrace"("workspaceId", "queryHash", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalTrace_permissionSnapshotHash_idx" ON "RetrievalTrace"("permissionSnapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "ContextPacket_retrievalTraceId_key" ON "ContextPacket"("retrievalTraceId");

-- CreateIndex
CREATE INDEX "ContextPacket_workspaceId_requesterMemberId_queryHash_creat_idx" ON "ContextPacket"("workspaceId", "requesterMemberId", "queryHash", "createdAt");

-- CreateIndex
CREATE INDEX "ContextPacket_previousPacketId_idx" ON "ContextPacket"("previousPacketId");

-- CreateIndex
CREATE INDEX "ContextPacket_packetHash_idx" ON "ContextPacket"("packetHash");

-- CreateIndex
CREATE INDEX "ContextPacketClaim_claimId_idx" ON "ContextPacketClaim"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextPacketClaim_contextPacketId_rank_key" ON "ContextPacketClaim"("contextPacketId", "rank");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConnection" ADD CONSTRAINT "SourceConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConnectionAccess" ADD CONSTRAINT "SourceConnectionAccess_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceConnectionAccess" ADD CONSTRAINT "SourceConnectionAccess_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObject" ADD CONSTRAINT "SourceObject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObject" ADD CONSTRAINT "SourceObject_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObjectAccess" ADD CONSTRAINT "SourceObjectAccess_sourceObjectId_fkey" FOREIGN KEY ("sourceObjectId") REFERENCES "SourceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObjectAccess" ADD CONSTRAINT "SourceObjectAccess_sourceConnectionAccessId_fkey" FOREIGN KEY ("sourceConnectionAccessId") REFERENCES "SourceConnectionAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObjectAccess" ADD CONSTRAINT "SourceObjectAccess_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_sourceObjectId_fkey" FOREIGN KEY ("sourceObjectId") REFERENCES "SourceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "SourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_reviewedByMemberId_fkey" FOREIGN KEY ("reviewedByMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_supersedesClaimId_fkey" FOREIGN KEY ("supersedesClaimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalTrace" ADD CONSTRAINT "RetrievalTrace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalTrace" ADD CONSTRAINT "RetrievalTrace_requesterMemberId_fkey" FOREIGN KEY ("requesterMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacket" ADD CONSTRAINT "ContextPacket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacket" ADD CONSTRAINT "ContextPacket_requesterMemberId_fkey" FOREIGN KEY ("requesterMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacket" ADD CONSTRAINT "ContextPacket_retrievalTraceId_fkey" FOREIGN KEY ("retrievalTraceId") REFERENCES "RetrievalTrace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacket" ADD CONSTRAINT "ContextPacket_previousPacketId_fkey" FOREIGN KEY ("previousPacketId") REFERENCES "ContextPacket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacketClaim" ADD CONSTRAINT "ContextPacketClaim_contextPacketId_fkey" FOREIGN KEY ("contextPacketId") REFERENCES "ContextPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextPacketClaim" ADD CONSTRAINT "ContextPacketClaim_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Narrow domain checks keep trust-state strings from drifting silently.
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_type_check"
  CHECK ("type" IN ('personal', 'team', 'project'));
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_status_check"
  CHECK ("status" IN ('active', 'archived'));
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_role_check"
  CHECK ("role" IN ('owner', 'admin', 'member', 'viewer'));
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_status_check"
  CHECK ("status" IN ('active', 'invited', 'suspended', 'removed'));
ALTER TABLE "SourceConnection" ADD CONSTRAINT "SourceConnection_provider_check"
  CHECK ("provider" IN ('github', 'linear'));
ALTER TABLE "SourceConnection" ADD CONSTRAINT "SourceConnection_status_check"
  CHECK ("status" IN ('active', 'paused', 'error', 'revoked'));
ALTER TABLE "SourceConnectionAccess" ADD CONSTRAINT "SourceConnectionAccess_permission_check"
  CHECK ("permission" IN ('read'));
ALTER TABLE "SourceObjectAccess" ADD CONSTRAINT "SourceObjectAccess_permission_check"
  CHECK ("permission" IN ('read'));
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_status_check"
  CHECK ("status" IN ('proposed', 'accepted', 'rejected', 'superseded', 'stale'));
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_confidence_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_role_check"
  CHECK ("role" IN ('supports', 'contradicts', 'supersedes'));
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_relevance_check"
  CHECK ("relevance" >= 0 AND "relevance" <= 1);

-- Cross-table workspace/permission chains must remain coherent.
CREATE OR REPLACE FUNCTION public.memoato_validate_context_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_workspace TEXT;
  expected_connection TEXT;
  expected_member TEXT;
  expected_object TEXT;
  expected_claim_key TEXT;
  expected_requester TEXT;
  expected_query_hash TEXT;
  expected_permission_hash TEXT;
  expected_policy TEXT;
  expected_permission_version INTEGER;
  expected_connection_version INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'SourceObject' THEN
    SELECT "workspaceId" INTO expected_workspace FROM "SourceConnection" WHERE id = NEW."sourceConnectionId";
    IF expected_workspace IS DISTINCT FROM NEW."workspaceId" THEN
      RAISE EXCEPTION 'context_scope_mismatch: source_object';
    END IF;
  ELSIF TG_TABLE_NAME = 'SourceConnectionAccess' THEN
    SELECT "workspaceId" INTO expected_workspace FROM "SourceConnection" WHERE id = NEW."sourceConnectionId";
    IF expected_workspace IS DISTINCT FROM (SELECT "workspaceId" FROM "WorkspaceMember" WHERE id = NEW."workspaceMemberId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: connection_access';
    END IF;
  ELSIF TG_TABLE_NAME = 'SourceObjectAccess' THEN
    SELECT "sourceConnectionId", "workspaceMemberId", "permissionVersion"
      INTO expected_connection, expected_member, expected_permission_version
      FROM "SourceConnectionAccess" WHERE id = NEW."sourceConnectionAccessId";
    SELECT "sourceConnectionId" INTO expected_object FROM "SourceObject" WHERE id = NEW."sourceObjectId";
    SELECT "permissionVersion" INTO expected_connection_version
      FROM "SourceConnection" WHERE id = expected_connection;
    IF expected_connection IS DISTINCT FROM expected_object
       OR expected_member IS DISTINCT FROM NEW."workspaceMemberId"
       OR expected_permission_version IS DISTINCT FROM NEW."connectionAccessPermissionVersion"
       OR expected_connection_version IS DISTINCT FROM NEW."connectionPermissionVersion" THEN
      RAISE EXCEPTION 'context_scope_mismatch: object_access';
    END IF;
  ELSIF TG_TABLE_NAME = 'SourceVersion' THEN
    SELECT "workspaceId" INTO expected_workspace FROM "SourceObject" WHERE id = NEW."sourceObjectId";
    IF expected_workspace IS DISTINCT FROM NEW."workspaceId" THEN
      RAISE EXCEPTION 'context_scope_mismatch: source_version';
    END IF;
    IF NEW."previousVersionId" IS NOT NULL AND
       NEW."sourceObjectId" IS DISTINCT FROM (SELECT "sourceObjectId" FROM "SourceVersion" WHERE id = NEW."previousVersionId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: source_version_chain';
    END IF;
  ELSIF TG_TABLE_NAME = 'Claim' THEN
    IF NEW."reviewedByMemberId" IS NOT NULL AND
       NEW."workspaceId" IS DISTINCT FROM (SELECT "workspaceId" FROM "WorkspaceMember" WHERE id = NEW."reviewedByMemberId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: claim_reviewer';
    END IF;
    IF NEW."supersedesClaimId" IS NOT NULL THEN
      SELECT "workspaceId", "claimKey" INTO expected_workspace, expected_claim_key
        FROM "Claim" WHERE id = NEW."supersedesClaimId";
      IF expected_workspace IS DISTINCT FROM NEW."workspaceId" OR expected_claim_key IS DISTINCT FROM NEW."claimKey" THEN
        RAISE EXCEPTION 'context_scope_mismatch: claim_supersession';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'ClaimEvidence' THEN
    SELECT "workspaceId" INTO expected_workspace FROM "Claim" WHERE id = NEW."claimId";
    IF expected_workspace IS DISTINCT FROM (SELECT "workspaceId" FROM "SourceVersion" WHERE id = NEW."sourceVersionId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: claim_evidence';
    END IF;
  ELSIF TG_TABLE_NAME = 'RetrievalTrace' THEN
    IF NEW."workspaceId" IS DISTINCT FROM (SELECT "workspaceId" FROM "WorkspaceMember" WHERE id = NEW."requesterMemberId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: retrieval_trace';
    END IF;
  ELSIF TG_TABLE_NAME = 'ContextPacket' THEN
    SELECT "workspaceId", "requesterMemberId", "queryHash", "permissionSnapshotHash", "policyVersion"
      INTO expected_workspace, expected_requester, expected_query_hash, expected_permission_hash, expected_policy
      FROM "RetrievalTrace" WHERE id = NEW."retrievalTraceId";
    IF NEW."workspaceId" IS DISTINCT FROM (SELECT "workspaceId" FROM "WorkspaceMember" WHERE id = NEW."requesterMemberId") OR
       NEW."workspaceId" IS DISTINCT FROM expected_workspace OR
       NEW."requesterMemberId" IS DISTINCT FROM expected_requester OR
       NEW."queryHash" IS DISTINCT FROM expected_query_hash OR
       NEW."permissionSnapshotHash" IS DISTINCT FROM expected_permission_hash OR
       NEW."policyVersion" IS DISTINCT FROM expected_policy THEN
      RAISE EXCEPTION 'context_scope_mismatch: context_packet';
    END IF;
    IF NEW."previousPacketId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "ContextPacket"
      WHERE id = NEW."previousPacketId"
        AND "workspaceId" = NEW."workspaceId"
        AND "requesterMemberId" = NEW."requesterMemberId"
        AND "queryHash" = NEW."queryHash"
        AND "policyVersion" = NEW."policyVersion"
    ) THEN
      RAISE EXCEPTION 'context_scope_mismatch: previous_context_packet';
    END IF;
  ELSIF TG_TABLE_NAME = 'ContextPacketClaim' THEN
    IF (SELECT "workspaceId" FROM "ContextPacket" WHERE id = NEW."contextPacketId")
       IS DISTINCT FROM (SELECT "workspaceId" FROM "Claim" WHERE id = NEW."claimId") THEN
      RAISE EXCEPTION 'context_scope_mismatch: context_packet_claim';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SourceObject_scope_guard" BEFORE INSERT OR UPDATE ON "SourceObject"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "SourceConnectionAccess_scope_guard" BEFORE INSERT OR UPDATE ON "SourceConnectionAccess"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "SourceObjectAccess_scope_guard" BEFORE INSERT OR UPDATE ON "SourceObjectAccess"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "SourceVersion_scope_guard" BEFORE INSERT ON "SourceVersion"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "Claim_scope_guard" BEFORE INSERT OR UPDATE ON "Claim"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "ClaimEvidence_scope_guard" BEFORE INSERT ON "ClaimEvidence"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "RetrievalTrace_scope_guard" BEFORE INSERT ON "RetrievalTrace"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "ContextPacket_scope_guard" BEFORE INSERT ON "ContextPacket"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();
CREATE TRIGGER "ContextPacketClaim_scope_guard" BEFORE INSERT ON "ContextPacketClaim"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_context_scope();

-- Accepted claims require an explicit human reviewer and supporting evidence.
CREATE OR REPLACE FUNCTION public.memoato_validate_accepted_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF NEW."reviewedByMemberId" IS NULL OR NEW."reviewedAt" IS NULL THEN
      RAISE EXCEPTION 'accepted_claim_requires_reviewer';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "WorkspaceMember"
      WHERE id = NEW."reviewedByMemberId"
        AND "workspaceId" = NEW."workspaceId"
        AND status = 'active'
        AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'accepted_claim_requires_authorized_reviewer';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "ClaimEvidence"
      WHERE "claimId" = NEW.id AND role = 'supports'
    ) THEN
      RAISE EXCEPTION 'accepted_claim_requires_supporting_evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Claim_acceptance_guard"
AFTER INSERT OR UPDATE OF status, "reviewedByMemberId", "reviewedAt" ON "Claim"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.memoato_validate_accepted_claim();

-- Raw evidence, evidence edges and emitted packets/traces are append-only.
CREATE OR REPLACE FUNCTION public.memoato_reject_context_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND
     current_setting('memoato.allow_context_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'immutable_context_record: %', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "SourceVersion_immutable" BEFORE UPDATE OR DELETE ON "SourceVersion"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_reject_context_mutation();
CREATE TRIGGER "ClaimEvidence_immutable" BEFORE UPDATE OR DELETE ON "ClaimEvidence"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_reject_context_mutation();
CREATE TRIGGER "RetrievalTrace_immutable" BEFORE UPDATE OR DELETE ON "RetrievalTrace"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_reject_context_mutation();
CREATE TRIGGER "ContextPacket_immutable" BEFORE UPDATE OR DELETE ON "ContextPacket"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_reject_context_mutation();
CREATE TRIGGER "ContextPacketClaim_immutable" BEFORE UPDATE OR DELETE ON "ContextPacketClaim"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_reject_context_mutation();

-- Claim meaning is immutable; review state changes are the only supported update.
CREATE OR REPLACE FUNCTION public.memoato_guard_claim_semantics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
       OR (OLD.status = 'accepted' AND NEW.status IN ('superseded', 'stale'))
     ) THEN
    RAISE EXCEPTION 'invalid_claim_status_transition';
  END IF;
  IF OLD.status <> 'proposed' AND (
       NEW."reviewedByMemberId" IS DISTINCT FROM OLD."reviewedByMemberId"
       OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
       OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
     ) THEN
    RAISE EXCEPTION 'immutable_claim_review';
  END IF;
  IF NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId"
     OR NEW."claimKey" IS DISTINCT FROM OLD."claimKey"
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.statement IS DISTINCT FROM OLD.statement
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW."proposerType" IS DISTINCT FROM OLD."proposerType"
     OR NEW."proposerRef" IS DISTINCT FROM OLD."proposerRef"
     OR NEW."policyVersion" IS DISTINCT FROM OLD."policyVersion"
     OR NEW."validFrom" IS DISTINCT FROM OLD."validFrom"
     OR NEW."validTo" IS DISTINCT FROM OLD."validTo"
     OR NEW."freshUntil" IS DISTINCT FROM OLD."freshUntil"
     OR NEW."supersedesClaimId" IS DISTINCT FROM OLD."supersedesClaimId" THEN
    RAISE EXCEPTION 'immutable_claim_semantics';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Claim_semantics_immutable" BEFORE UPDATE ON "Claim"
  FOR EACH ROW EXECUTE FUNCTION public.memoato_guard_claim_semantics();
