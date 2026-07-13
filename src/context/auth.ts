import { HttpError } from "wasp/server";

type PrismaLike = any;

export const CONTEXT_REVIEW_ROLES = new Set(["owner", "admin"]);

export async function requireWorkspaceMember(args: {
  prisma: PrismaLike;
  userId: string;
  workspaceId: string;
  roles?: Set<string>;
}) {
  const member = await args.prisma.workspaceMember.findFirst({
    where: {
      workspaceId: args.workspaceId,
      userId: args.userId,
      status: "active",
    },
    include: { workspace: true },
  });
  if (!member) throw new HttpError(404, "Workspace not found.");
  if (args.roles && !args.roles.has(member.role)) {
    throw new HttpError(403, "Workspace permission denied.");
  }
  return member;
}

export async function requireConnectionRead(args: {
  prisma: PrismaLike;
  memberId: string;
  connectionId: string;
}) {
  const access = await args.prisma.sourceConnectionAccess.findFirst({
    where: {
      sourceConnectionId: args.connectionId,
      workspaceMemberId: args.memberId,
      permission: "read",
      revokedAt: null,
      sourceConnection: { status: "active" },
    },
    include: { sourceConnection: true },
  });
  if (!access) throw new HttpError(403, "Source permission denied.");
  return access;
}
