import { createHash } from "node:crypto";
import { HttpError } from "wasp/server";
import { contextHash } from "./policy";
import { fetchConnectionRecords } from "./providers";
import type { ExternalSourceRecord } from "./types";

type PrismaLike = any;

function excerptHash(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text ? createHash("sha256").update(text).digest("hex") : null;
}

async function materializeObjectGrants(args: {
  tx: PrismaLike;
  sourceObjectId: string;
  connectionId: string;
  sourcePermissionVersion: number;
  connectionPermissionVersion: number;
}) {
  const accesses = await args.tx.sourceConnectionAccess.findMany({
    where: {
      sourceConnectionId: args.connectionId,
      permission: "read",
      revokedAt: null,
      workspaceMember: { status: "active" },
    },
    select: { id: true, workspaceMemberId: true, permissionVersion: true },
  });
  for (const access of accesses) {
    await args.tx.sourceObjectAccess.upsert({
      where: {
        sourceObjectId_workspaceMemberId: {
          sourceObjectId: args.sourceObjectId,
          workspaceMemberId: access.workspaceMemberId,
        },
      },
      create: {
        sourceObjectId: args.sourceObjectId,
        sourceConnectionAccessId: access.id,
        workspaceMemberId: access.workspaceMemberId,
        permission: "read",
        sourcePermissionVersion: args.sourcePermissionVersion,
        connectionPermissionVersion: args.connectionPermissionVersion,
        connectionAccessPermissionVersion: access.permissionVersion,
      },
      update: {
        sourceConnectionAccessId: access.id,
        permission: "read",
        sourcePermissionVersion: args.sourcePermissionVersion,
        connectionPermissionVersion: args.connectionPermissionVersion,
        connectionAccessPermissionVersion: access.permissionVersion,
        observedAt: new Date(),
        revokedAt: null,
      },
    });
  }
  return accesses.length;
}

async function proposeClaims(args: {
  tx: PrismaLike;
  workspaceId: string;
  sourceObjectId: string;
  sourceVersionId: string;
  record: ExternalSourceRecord;
}) {
  let proposed = 0;
  for (const proposal of args.record.proposedClaims) {
    const existing = await args.tx.claimEvidence.findFirst({
      where: {
        sourceVersionId: args.sourceVersionId,
        role: "supports",
        claim: {
          workspaceId: args.workspaceId,
          claimKey: proposal.claimKey,
          policyVersion: proposal.policyVersion,
        },
      },
      select: { id: true },
    });
    if (existing) continue;

    const previous = await args.tx.claim.findFirst({
      where: {
        workspaceId: args.workspaceId,
        claimKey: proposal.claimKey,
        status: { in: ["proposed", "accepted", "stale"] },
        evidence: {
          some: { sourceVersion: { sourceObjectId: args.sourceObjectId } },
        },
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }],
    });
    await args.tx.claim.create({
      data: {
        workspaceId: args.workspaceId,
        claimKey: proposal.claimKey,
        kind: proposal.kind,
        statement: proposal.statement,
        status: "proposed",
        confidence: proposal.confidence,
        proposerType: "deterministic",
        proposerRef: args.record.provider,
        policyVersion: proposal.policyVersion,
        validFrom: proposal.validFrom ?? args.record.sourceUpdatedAt ?? null,
        freshUntil: proposal.freshUntil ?? null,
        supersedesClaimId: previous?.id ?? null,
        evidence: {
          create: {
            sourceVersionId: args.sourceVersionId,
            role: "supports",
            locator: proposal.locator ?? undefined,
            excerpt: proposal.excerpt ?? null,
            excerptHash: excerptHash(proposal.excerpt),
            relevance: 1,
          },
        },
      },
    });
    proposed += 1;
  }
  return proposed;
}

export async function persistSourceRecord(args: {
  prisma: PrismaLike;
  connection: any;
  record: ExternalSourceRecord;
}): Promise<{
  createdVersion: boolean;
  proposedClaims: number;
  materializedGrants: number;
}> {
  const contentHash = contextHash(args.record.rawPayload);
  return args.prisma.$transaction(
    async (tx: PrismaLike) => {
      const sourceObject = await tx.sourceObject.upsert({
        where: {
          sourceConnectionId_objectType_externalId: {
            sourceConnectionId: args.connection.id,
            objectType: args.record.objectType,
            externalId: args.record.externalId,
          },
        },
        create: {
          workspaceId: args.connection.workspaceId,
          sourceConnectionId: args.connection.id,
          provider: args.record.provider,
          objectType: args.record.objectType,
          externalId: args.record.externalId,
          stableKey: args.record.stableKey,
          canonicalUrl: args.record.canonicalUrl ?? null,
          upstreamScope: args.record.upstreamScope,
          status: "active",
        },
        update: {
          canonicalUrl: args.record.canonicalUrl ?? null,
          upstreamScope: args.record.upstreamScope,
          status: "active",
          sourceDeletedAt: null,
          lastSeenAt: new Date(),
        },
      });
      const materializedGrants = await materializeObjectGrants({
        tx,
        sourceObjectId: sourceObject.id,
        connectionId: args.connection.id,
        sourcePermissionVersion: args.record.sourcePermissionVersion,
        connectionPermissionVersion: args.connection.permissionVersion,
      });
      const latest = await tx.sourceVersion.findFirst({
        where: { sourceObjectId: sourceObject.id },
        select: { id: true, ordinal: true, contentHash: true },
        orderBy: [{ ordinal: "desc" }],
      });
      if (latest?.contentHash === contentHash) {
        return {
          createdVersion: false,
          proposedClaims: 0,
          materializedGrants,
        };
      }
      const version = await tx.sourceVersion.create({
        data: {
          workspaceId: args.connection.workspaceId,
          sourceObjectId: sourceObject.id,
          previousVersionId: latest?.id ?? null,
          ordinal: (latest?.ordinal ?? 0) + 1,
          externalVersion: args.record.externalVersion ?? null,
          contentHash,
          rawPayload: args.record.rawPayload,
          normalizedText: args.record.normalizedText,
          sourceUpdatedAt: args.record.sourceUpdatedAt ?? null,
        },
      });
      const proposedClaims = await proposeClaims({
        tx,
        workspaceId: args.connection.workspaceId,
        sourceObjectId: sourceObject.id,
        sourceVersionId: version.id,
        record: args.record,
      });
      return {
        createdVersion: true,
        proposedClaims,
        materializedGrants,
      };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function syncContextConnection(args: {
  prisma: PrismaLike;
  connection: any;
  fetchImpl?: typeof fetch;
}) {
  try {
    const records = await fetchConnectionRecords({
      connection: args.connection,
      fetchImpl: args.fetchImpl,
    });
    let versionsCreated = 0;
    let claimsProposed = 0;
    for (const record of records) {
      const result = await persistSourceRecord({
        prisma: args.prisma,
        connection: args.connection,
        record,
      });
      if (result.createdVersion) versionsCreated += 1;
      claimsProposed += result.proposedClaims;
    }
    await args.prisma.sourceConnection.update({
      where: { id: args.connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
        syncCursor: {
          bounded: true,
          recordsSeen: records.length,
          syncedAt: new Date().toISOString(),
        },
      },
    });
    return {
      connectionId: args.connection.id,
      recordsSeen: records.length,
      versionsCreated,
      claimsProposed,
    };
  } catch (error) {
    await args.prisma.sourceConnection.updateMany({
      where: { id: args.connection.id },
      data: {
        lastSyncError:
          error instanceof Error ? error.message.slice(0, 500) : "sync_failed",
      },
    });
    throw error;
  }
}

export async function reviewProposedClaim(args: {
  prisma: PrismaLike;
  workspaceId: string;
  memberId: string;
  claimId: string;
  action: "accept" | "reject";
  note?: string | null;
}) {
  return args.prisma.$transaction(async (tx: PrismaLike) => {
    const claim = await tx.claim.findFirst({
      where: {
        id: args.claimId,
        workspaceId: args.workspaceId,
        status: "proposed",
      },
      include: {
        evidence: { where: { role: "supports" }, select: { id: true } },
      },
    });
    if (!claim) throw new HttpError(404, "Proposed claim not found.");
    if (args.action === "accept" && claim.evidence.length === 0) {
      throw new HttpError(409, "A claim needs supporting evidence.");
    }
    const status = args.action === "accept" ? "accepted" : "rejected";
    const updated = await tx.claim.update({
      where: { id: claim.id },
      data: {
        status,
        reviewedByMemberId: args.memberId,
        reviewedAt: new Date(),
        reviewNote:
          String(args.note ?? "")
            .trim()
            .slice(0, 500) || null,
      },
    });
    if (status === "accepted" && claim.supersedesClaimId) {
      await tx.claim.updateMany({
        where: {
          id: claim.supersedesClaimId,
          workspaceId: args.workspaceId,
          status: "accepted",
        },
        data: { status: "superseded" },
      });
    }
    return updated;
  });
}
