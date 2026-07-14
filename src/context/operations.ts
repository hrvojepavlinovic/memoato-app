import { randomUUID } from "node:crypto";
import { HttpError, prisma } from "wasp/server";
import type {
  BuildContextPacket,
  ConnectContextSource,
  CreateContextWorkspace,
  GetContextOverview,
  ReviewContextClaim,
  SyncContextSource,
} from "wasp/server/operations";
import {
  CONTEXT_REVIEW_ROLES,
  requireConnectionRead,
  requireWorkspaceMember,
} from "./auth";
import { reviewProposedClaim, syncContextConnection } from "./ingest";
import { buildPermissionFilteredContextPacket } from "./packet";
import { normalizeGitHubConfig, normalizeLinearConfig } from "./providers";
import type { ContextProvider } from "./types";

function requireUser(context: any): string {
  if (!context.user) throw new HttpError(401);
  return context.user.id;
}

async function requireConnectorAdmin(context: any): Promise<string> {
  const userId = requireUser(context);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    throw new HttpError(403, "Context connectors are restricted to administrators.");
  }
  return userId;
}

function envAllowlist(name: string): Set<string> {
  return new Set(
    String(process.env[name] ?? "")
      .split(/[\n,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function assertProviderScopeAllowed(
  provider: ContextProvider,
  config: ReturnType<typeof normalizeGitHubConfig | typeof normalizeLinearConfig>,
): void {
  if (provider === "github") {
    const github = config as ReturnType<typeof normalizeGitHubConfig>;
    const allowed = envAllowlist("GITHUB_CONTEXT_ALLOWED_REPOSITORIES");
    const requested = github.repositories.map(
      (repository) => `${github.organization}/${repository}`.toLowerCase(),
    );
    if (allowed.size === 0 || requested.some((repository) => !allowed.has(repository))) {
      throw new HttpError(403, "GitHub repository is not allowlisted.");
    }
    return;
  }
  const linear = config as ReturnType<typeof normalizeLinearConfig>;
  const allowed = envAllowlist("LINEAR_CONTEXT_ALLOWED_TEAM_IDS");
  if (allowed.size === 0 || !allowed.has(linear.teamId.toLowerCase())) {
    throw new HttpError(403, "Linear team is not allowlisted.");
  }
}

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function workspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

function providerFrom(value: unknown): ContextProvider {
  const provider = clean(value, 20);
  if (provider !== "github" && provider !== "linear") {
    throw new HttpError(400, "Provider must be GitHub or Linear.");
  }
  return provider;
}

function credentialRef(provider: ContextProvider): string {
  return provider === "github"
    ? "env:GITHUB_CONTEXT_TOKEN"
    : "env:LINEAR_CONTEXT_API_KEY";
}

function objectAccessWhere(memberId: string) {
  return {
    some: {
      workspaceMemberId: memberId,
      permission: "read",
      revokedAt: null,
      sourceConnectionAccess: {
        workspaceMemberId: memberId,
        permission: "read",
        revokedAt: null,
        sourceConnection: { status: "active" },
      },
    },
  };
}

export const createContextWorkspace: CreateContextWorkspace<any, any> = async (
  args,
  context,
) => {
  const userId = requireUser(context);
  const name = clean(args?.name, 120);
  const type = clean(args?.type, 20) || "project";
  if (!name) throw new HttpError(400, "Workspace name is required.");
  if (type !== "team" && type !== "project") {
    throw new HttpError(400, "Workspace type must be team or project.");
  }
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        creatorId: userId,
        slug: workspaceSlug(name),
        name,
        type,
        status: "active",
        members: {
          create: {
            userId,
            role: "owner",
            status: "active",
          },
        },
      },
      select: { id: true, slug: true, name: true, type: true },
    });
    return workspace;
  });
};

export const connectContextSource: ConnectContextSource<any, any> = async (
  args,
  context,
) => {
  const userId = await requireConnectorAdmin(context);
  const workspaceId = clean(args?.workspaceId, 100);
  const member = await requireWorkspaceMember({
    prisma,
    userId,
    workspaceId,
    roles: CONTEXT_REVIEW_ROLES,
  });
  const provider = providerFrom(args?.provider);
  let config: ReturnType<
    typeof normalizeGitHubConfig | typeof normalizeLinearConfig
  >;
  let externalAccountId: string;
  let defaultDisplayName: string;
  if (provider === "github") {
    const githubConfig = normalizeGitHubConfig(args?.config);
    config = githubConfig;
    externalAccountId = githubConfig.organization;
    defaultDisplayName = githubConfig.organization;
  } else {
    const linearConfig = normalizeLinearConfig(args?.config);
    config = linearConfig;
    externalAccountId = linearConfig.teamId;
    defaultDisplayName = linearConfig.teamName;
  }
  assertProviderScopeAllowed(provider, config);
  const displayName = clean(args?.displayName, 160) || defaultDisplayName;
  const existing = await prisma.sourceConnection.findUnique({
    where: {
      workspaceId_provider_externalAccountId: {
        workspaceId,
        provider,
        externalAccountId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "This source is already connected.");
  }
  return prisma.$transaction(async (tx) => {
    const connection = await tx.sourceConnection.create({
      data: {
        workspaceId,
        provider,
        externalAccountId,
        displayName,
        credentialRef: credentialRef(provider),
        config,
        status: "active",
      },
    });
    await tx.sourceConnectionAccess.create({
      data: {
        sourceConnectionId: connection.id,
        workspaceMemberId: member.id,
        permission: "read",
        upstreamPrincipal: {
          source: "explicit_owner_connection",
          userId,
        },
      },
    });
    return {
      id: connection.id,
      provider,
      displayName,
      externalAccountId,
      status: connection.status,
    };
  });
};

export const syncContextSource: SyncContextSource<any, any> = async (
  args,
  context,
) => {
  const userId = await requireConnectorAdmin(context);
  const workspaceId = clean(args?.workspaceId, 100);
  const connectionId = clean(args?.connectionId, 100);
  const member = await requireWorkspaceMember({
    prisma,
    userId,
    workspaceId,
    roles: CONTEXT_REVIEW_ROLES,
  });
  const access = await requireConnectionRead({
    prisma,
    memberId: member.id,
    connectionId,
  });
  if (access.sourceConnection.workspaceId !== workspaceId) {
    throw new HttpError(404, "Source not found.");
  }
  const provider = providerFrom(access.sourceConnection.provider);
  const config =
    provider === "github"
      ? normalizeGitHubConfig(access.sourceConnection.config)
      : normalizeLinearConfig(access.sourceConnection.config);
  assertProviderScopeAllowed(provider, config);
  return syncContextConnection({
    prisma,
    connection: access.sourceConnection,
  });
};

export const reviewContextClaim: ReviewContextClaim<any, any> = async (
  args,
  context,
) => {
  const userId = requireUser(context);
  const workspaceId = clean(args?.workspaceId, 100);
  const claimId = clean(args?.claimId, 100);
  const action = clean(args?.action, 20);
  if (action !== "accept" && action !== "reject") {
    throw new HttpError(400, "Review action must be accept or reject.");
  }
  const member = await requireWorkspaceMember({
    prisma,
    userId,
    workspaceId,
    roles: CONTEXT_REVIEW_ROLES,
  });
  const visible = await prisma.claim.count({
    where: {
      id: claimId,
      workspaceId,
      evidence: {
        some: {},
        every: {
          sourceVersion: {
            sourceObject: { accessGrants: objectAccessWhere(member.id) },
          },
        },
      },
    },
  });
  if (visible !== 1) throw new HttpError(404, "Claim not found.");
  const claim = await reviewProposedClaim({
    prisma,
    workspaceId,
    memberId: member.id,
    claimId,
    action,
    note: clean(args?.note, 500) || null,
  });
  return { id: claim.id, status: claim.status };
};

export const buildContextPacket: BuildContextPacket<any, any> = async (
  args,
  context,
) => {
  const userId = requireUser(context);
  const workspaceId = clean(args?.workspaceId, 100);
  const member = await requireWorkspaceMember({
    prisma,
    userId,
    workspaceId,
  });
  return buildPermissionFilteredContextPacket({
    prisma,
    member,
    query: clean(args?.query, 240),
    take: Number(args?.take),
  });
};

export const getContextOverview: GetContextOverview<any, any> = async (
  args,
  context,
) => {
  const userId = requireUser(context);
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, status: "active" },
    include: { workspace: true },
    orderBy: [{ joinedAt: "asc" }],
  });
  const requestedWorkspaceId = clean(args?.workspaceId, 100);
  const member =
    memberships.find((item) => item.workspaceId === requestedWorkspaceId) ??
    memberships.find((item) => item.workspace.type !== "personal") ??
    null;
  const workspaces = memberships.map((item) => ({
    id: item.workspaceId,
    slug: item.workspace.slug,
    name: item.workspace.name,
    type: item.workspace.type,
    role: item.role,
  }));
  if (!member) {
    return {
      workspaces,
      workspace: null,
      connections: [],
      proposedClaims: [],
      counts: { sourceObjects: 0, sourceVersions: 0, acceptedClaims: 0 },
      providers: {
        githubConfigured: !!process.env.GITHUB_CONTEXT_TOKEN,
        linearConfigured: !!process.env.LINEAR_CONTEXT_API_KEY,
      },
    };
  }
  const accessWhere = objectAccessWhere(member.id);
  const [
    connections,
    proposedClaims,
    sourceObjects,
    sourceVersions,
    acceptedClaims,
  ] = await Promise.all([
    prisma.sourceConnection.findMany({
      where: {
        workspaceId: member.workspaceId,
        accesses: {
          some: {
            workspaceMemberId: member.id,
            permission: "read",
            revokedAt: null,
          },
        },
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        externalAccountId: true,
        status: true,
        lastSyncAt: true,
        lastSyncError: true,
        _count: { select: { objects: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.claim.findMany({
      where: {
        workspaceId: member.workspaceId,
        status: "proposed",
        evidence: {
          some: {},
          every: {
            sourceVersion: {
              sourceObject: { accessGrants: accessWhere },
            },
          },
        },
      },
      select: {
        id: true,
        claimKey: true,
        kind: true,
        statement: true,
        confidence: true,
        freshUntil: true,
        createdAt: true,
        evidence: {
          select: {
            role: true,
            excerpt: true,
            sourceVersion: {
              select: {
                contentHash: true,
                sourceUpdatedAt: true,
                sourceObject: {
                  select: {
                    stableKey: true,
                    canonicalUrl: true,
                    provider: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.sourceObject.count({
      where: {
        workspaceId: member.workspaceId,
        accessGrants: accessWhere,
      },
    }),
    prisma.sourceVersion.count({
      where: {
        workspaceId: member.workspaceId,
        sourceObject: { accessGrants: accessWhere },
      },
    }),
    prisma.claim.count({
      where: {
        workspaceId: member.workspaceId,
        status: "accepted",
        evidence: {
          some: {},
          every: {
            sourceVersion: {
              sourceObject: { accessGrants: accessWhere },
            },
          },
        },
      },
    }),
  ]);
  return {
    workspaces,
    workspace: {
      id: member.workspaceId,
      slug: member.workspace.slug,
      name: member.workspace.name,
      type: member.workspace.type,
      role: member.role,
    },
    connections,
    proposedClaims,
    counts: { sourceObjects, sourceVersions, acceptedClaims },
    providers: {
      githubConfigured: !!process.env.GITHUB_CONTEXT_TOKEN,
      linearConfigured: !!process.env.LINEAR_CONTEXT_API_KEY,
    },
  };
};
