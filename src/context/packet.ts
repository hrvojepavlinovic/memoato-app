import {
  CONTEXT_PACKET_LIMIT,
  CONTEXT_POLICY_VERSION,
  boundedContextPacketTake,
  contextHash,
  contextQueryTerms,
  normalizeContextQuery,
} from "./policy";
import type { ContextPacketClaim, MemoryDiff } from "./types";

type PrismaLike = any;

type ClaimWithEvidence = {
  id: string;
  claimKey: string;
  kind: string;
  statement: string;
  status: string;
  confidence: number;
  freshUntil: Date | null;
  evidence: Array<{ sourceVersionId: string }>;
};

export function isMaterializedGrantCurrent(grant: {
  connectionPermissionVersion: number;
  connectionAccessPermissionVersion: number;
  sourceConnectionAccess: {
    permissionVersion: number;
    sourceConnection: { permissionVersion: number };
  };
}): boolean {
  return (
    grant.connectionAccessPermissionVersion ===
      grant.sourceConnectionAccess.permissionVersion &&
    grant.connectionPermissionVersion ===
      grant.sourceConnectionAccess.sourceConnection.permissionVersion
  );
}

export function filterContextClaimsBeforeRanking(args: {
  claims: ClaimWithEvidence[];
  allowedVersionIds: Set<string>;
  now: Date;
}) {
  const allowed: ClaimWithEvidence[] = [];
  let permissionExcludedCount = 0;
  let staleExcludedCount = 0;
  for (const claim of args.claims) {
    const allEvidenceAllowed =
      claim.evidence.length > 0 &&
      claim.evidence.every((edge) =>
        args.allowedVersionIds.has(edge.sourceVersionId),
      );
    if (!allEvidenceAllowed) {
      permissionExcludedCount += 1;
      continue;
    }
    if (
      claim.status !== "accepted" ||
      (claim.freshUntil && claim.freshUntil.getTime() <= args.now.getTime())
    ) {
      staleExcludedCount += 1;
      continue;
    }
    allowed.push(claim);
  }
  return { allowed, permissionExcludedCount, staleExcludedCount };
}

export function rankContextClaims<T extends ClaimWithEvidence>(
  claims: T[],
  query: string,
  take = CONTEXT_PACKET_LIMIT,
): Array<T & { score: number }> {
  const safeTake = boundedContextPacketTake(take);
  const terms = contextQueryTerms(query);
  return claims
    .map((claim) => {
      const haystack = normalizeContextQuery(
        `${claim.claimKey} ${claim.kind} ${claim.statement}`,
      );
      const matched = terms.filter((term) => haystack.includes(term)).length;
      const score =
        terms.length === 0
          ? claim.confidence
          : matched === 0
            ? 0
            : matched === terms.length
              ? 1 + matched / terms.length + claim.confidence / 100
              : matched / terms.length + claim.confidence / 100;
      return { ...claim, score };
    })
    .filter((claim) => terms.length === 0 || claim.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.confidence - a.confidence ||
        a.claimKey.localeCompare(b.claimKey),
    )
    .slice(0, safeTake);
}

export function diffContextClaims(
  previous: Array<{ claimId: string; claimKey: string }>,
  current: Array<{ claimId: string; claimKey: string }>,
): MemoryDiff {
  const previousByKey = new Map(previous.map((item) => [item.claimKey, item]));
  const currentByKey = new Map(current.map((item) => [item.claimKey, item]));
  const changed: MemoryDiff["changed"] = [];
  const added: MemoryDiff["added"] = [];
  const removed: MemoryDiff["removed"] = [];
  let unchangedCount = 0;

  for (const item of current) {
    const prior = previousByKey.get(item.claimKey);
    if (!prior) {
      added.push(item);
    } else if (prior.claimId !== item.claimId) {
      changed.push({
        claimKey: item.claimKey,
        previousClaimId: prior.claimId,
        claimId: item.claimId,
      });
    } else {
      unchangedCount += 1;
    }
  }
  for (const item of previous) {
    if (!currentByKey.has(item.claimKey)) removed.push(item);
  }
  return { added, removed, changed, unchangedCount };
}

async function permissionSnapshot(args: { tx: PrismaLike; member: any }) {
  const member = await args.tx.workspaceMember.findFirst({
    where: {
      id: args.member.id,
      workspaceId: args.member.workspaceId,
      status: "active",
    },
    include: { workspace: true },
  });
  if (!member) {
    const error = new Error("workspace_permission_changed");
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
  const grants = await args.tx.sourceObjectAccess.findMany({
    where: {
      workspaceMemberId: member.id,
      permission: "read",
      revokedAt: null,
      sourceObject: { status: "active" },
      sourceConnectionAccess: {
        workspaceMemberId: member.id,
        permission: "read",
        revokedAt: null,
        sourceConnection: { status: "active" },
      },
    },
    select: {
      sourceObjectId: true,
      sourcePermissionVersion: true,
      connectionPermissionVersion: true,
      connectionAccessPermissionVersion: true,
      sourceConnectionAccess: {
        select: {
          sourceConnectionId: true,
          permissionVersion: true,
          sourceConnection: { select: { permissionVersion: true } },
        },
      },
      sourceObject: {
        select: {
          stableKey: true,
          versions: { select: { id: true }, orderBy: { ordinal: "asc" } },
        },
      },
    },
    orderBy: [{ sourceObjectId: "asc" }],
  });
  const allowedVersionIds = new Set<string>();
  const objects = grants.flatMap((grant: any) => {
    if (!isMaterializedGrantCurrent(grant)) {
      return [];
    }
    for (const version of grant.sourceObject.versions) {
      allowedVersionIds.add(version.id);
    }
    return {
      sourceObjectId: grant.sourceObjectId,
      stableKey: grant.sourceObject.stableKey,
      sourcePermissionVersion: grant.sourcePermissionVersion,
      sourceConnectionId: grant.sourceConnectionAccess.sourceConnectionId,
      connectionGrantVersion: grant.sourceConnectionAccess.permissionVersion,
      connectionAccessPermissionVersion:
        grant.connectionAccessPermissionVersion,
      connectionPermissionVersion: grant.connectionPermissionVersion,
    };
  });
  const snapshot = {
    workspaceMemberId: member.id,
    memberPermissionVersion: member.permissionVersion,
    policyVersion: member.workspace.policyVersion,
    objects,
  };
  return {
    snapshot,
    snapshotHash: contextHash(snapshot),
    allowedVersionIds,
    member,
  };
}

function toPacketClaim(claim: any): ContextPacketClaim {
  return {
    id: claim.id,
    claimKey: claim.claimKey,
    kind: claim.kind,
    statement: claim.statement,
    confidence: claim.confidence,
    freshUntil: claim.freshUntil,
    score: claim.score,
    evidence: claim.evidence.map((edge: any) => ({
      sourceVersionId: edge.sourceVersionId,
      sourceKey: edge.sourceVersion.sourceObject.stableKey,
      provider: edge.sourceVersion.sourceObject.provider,
      objectType: edge.sourceVersion.sourceObject.objectType,
      canonicalUrl: edge.sourceVersion.sourceObject.canonicalUrl,
      contentHash: edge.sourceVersion.contentHash,
      sourceUpdatedAt: edge.sourceVersion.sourceUpdatedAt,
      role: edge.role,
      locator: edge.locator,
      excerpt: edge.excerpt,
    })),
  };
}

function packetJsonClaim(claim: ContextPacketClaim) {
  return {
    ...claim,
    freshUntil: claim.freshUntil?.toISOString() ?? null,
    evidence: claim.evidence.map((edge) => ({
      ...edge,
      sourceUpdatedAt: edge.sourceUpdatedAt?.toISOString() ?? null,
    })),
  };
}

export async function buildPermissionFilteredContextPacket(args: {
  prisma: PrismaLike;
  member: any;
  query: string;
  take?: number;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const query = String(args.query ?? "")
    .trim()
    .slice(0, 240);
  const normalizedQuery = normalizeContextQuery(query);
  const take = boundedContextPacketTake(args.take);
  const queryHash = contextHash({
    query: normalizedQuery,
    take,
    policyVersion: CONTEXT_POLICY_VERSION,
  });

  return args.prisma.$transaction(
    async (tx: PrismaLike) => {
      const permission = await permissionSnapshot({ tx, member: args.member });
      const member = permission.member;
      const allowedVersionIds = Array.from(permission.allowedVersionIds);
      const evidencePermissionWhere = {
        some: {},
        every: { sourceVersionId: { in: allowedVersionIds } },
      };
      const authorizedTotal =
        allowedVersionIds.length === 0
          ? 0
          : await tx.claim.count({
              where: {
                workspaceId: member.workspaceId,
                status: "accepted",
                evidence: evidencePermissionWhere,
              },
            });
      const freshAuthorizedTotal =
        allowedVersionIds.length === 0
          ? 0
          : await tx.claim.count({
              where: {
                workspaceId: member.workspaceId,
                status: "accepted",
                evidence: evidencePermissionWhere,
                OR: [{ freshUntil: null }, { freshUntil: { gt: now } }],
              },
            });
      const candidates =
        allowedVersionIds.length === 0
          ? []
          : await tx.claim.findMany({
              where: {
                workspaceId: member.workspaceId,
                status: "accepted",
                evidence: evidencePermissionWhere,
                OR: [{ freshUntil: null }, { freshUntil: { gt: now } }],
              },
              include: {
                evidence: {
                  include: {
                    sourceVersion: {
                      include: {
                        sourceObject: {
                          select: {
                            stableKey: true,
                            provider: true,
                            objectType: true,
                            canonicalUrl: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: [{ createdAt: "desc" }],
              take: 500,
            });
      const ranked = rankContextClaims(candidates, normalizedQuery, take);
      const packetClaims = ranked.map(toPacketClaim);
      const previous = await tx.contextPacket.findFirst({
        where: {
          workspaceId: member.workspaceId,
          requesterMemberId: member.id,
          queryHash,
          policyVersion: CONTEXT_POLICY_VERSION,
        },
        include: {
          claims: {
            select: {
              claimId: true,
              claim: { select: { claimKey: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });
      const currentClaimRefs = packetClaims.map((claim) => ({
        claimId: claim.id,
        claimKey: claim.claimKey,
      }));
      const previousClaimRefs =
        previous?.claims.map((item: any) => ({
          claimId: item.claimId,
          claimKey: item.claim.claimKey,
        })) ?? [];
      const diff = diffContextClaims(previousClaimRefs, currentClaimRefs);
      const staleExcludedCount = Math.max(
        0,
        authorizedTotal - freshAuthorizedTotal,
      );
      // Do not turn authorization into a side channel: neither the packet nor
      // its requester-owned trace reveals how many inaccessible claims exist.
      const permissionExcludedCount = 0;
      const content = {
        query,
        normalizedQuery,
        limit: take,
        workspace: {
          id: member.workspaceId,
          name: member.workspace.name,
          type: member.workspace.type,
        },
        claims: packetClaims.map(packetJsonClaim),
        freshness: {
          generatedAt: now.toISOString(),
          freshUntil: (() => {
            const value = packetClaims
              .map((claim) => claim.freshUntil?.getTime())
              .filter((item): item is number => typeof item === "number")
              .sort((a, b) => a - b)[0];
            return value == null ? null : new Date(value).toISOString();
          })(),
        },
        exclusions: {
          permission: permissionExcludedCount,
          stale: staleExcludedCount,
        },
      };
      const packetHash = contextHash({
        content,
        diff,
        permissionSnapshotHash: permission.snapshotHash,
        policyVersion: CONTEXT_POLICY_VERSION,
      });
      const trace = await tx.retrievalTrace.create({
        data: {
          workspaceId: member.workspaceId,
          requesterMemberId: member.id,
          query,
          queryHash,
          policyVersion: CONTEXT_POLICY_VERSION,
          permissionSnapshot: permission.snapshot,
          permissionSnapshotHash: permission.snapshotHash,
          stages: [
            "membership",
            "connection_grants",
            "object_grants",
            "all_evidence_allowed",
            "freshness",
            "lexical_rank",
          ],
          candidateCount: freshAuthorizedTotal,
          includedCount: packetClaims.length,
          permissionExcludedCount,
          staleExcludedCount,
          status: "complete",
        },
      });
      const packet = await tx.contextPacket.create({
        data: {
          workspaceId: member.workspaceId,
          requesterMemberId: member.id,
          retrievalTraceId: trace.id,
          previousPacketId: previous?.id ?? null,
          queryHash,
          permissionSnapshotHash: permission.snapshotHash,
          policyVersion: CONTEXT_POLICY_VERSION,
          content,
          diff,
          packetHash,
          freshUntil:
            content.freshness.freshUntil == null
              ? null
              : new Date(content.freshness.freshUntil),
          claims: {
            create: packetClaims.map((claim, index) => ({
              claimId: claim.id,
              rank: index + 1,
              score: claim.score,
            })),
          },
        },
      });
      return {
        id: packet.id,
        traceId: trace.id,
        packetHash,
        permissionSnapshotHash: permission.snapshotHash,
        content,
        diff,
        createdAt: packet.createdAt,
      };
    },
    { isolationLevel: "Serializable" },
  );
}
