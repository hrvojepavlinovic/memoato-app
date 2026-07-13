export type AccountDeletionWorkspaceMembership = {
  workspaceId: string;
  workspace: {
    creatorId: string | null;
    _count: { members: number };
  };
};

export function contextWorkspacesForAccountDeletion(
  userId: string,
  memberships: AccountDeletionWorkspaceMembership[],
): { workspaceIds: string[]; blocked: boolean } {
  return {
    workspaceIds: memberships.map((membership) => membership.workspaceId),
    blocked: memberships.some(
      (membership) =>
        membership.workspace.creatorId !== userId ||
        membership.workspace._count.members > 1,
    ),
  };
}
