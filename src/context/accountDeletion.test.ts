import { describe, expect, it } from "vitest";
import { contextWorkspacesForAccountDeletion } from "./accountDeletion";

describe("context account deletion boundary", () => {
  it("allows purge of solo-owned workspaces", () => {
    expect(
      contextWorkspacesForAccountDeletion("user-1", [
        {
          workspaceId: "workspace-1",
          workspace: { creatorId: "user-1", _count: { members: 1 } },
        },
      ]),
    ).toEqual({ workspaceIds: ["workspace-1"], blocked: false });
  });

  it("blocks deletion when another member or owner is involved", () => {
    expect(
      contextWorkspacesForAccountDeletion("user-1", [
        {
          workspaceId: "workspace-1",
          workspace: { creatorId: "user-1", _count: { members: 2 } },
        },
      ]).blocked,
    ).toBe(true);
    expect(
      contextWorkspacesForAccountDeletion("user-1", [
        {
          workspaceId: "workspace-2",
          workspace: { creatorId: "user-2", _count: { members: 1 } },
        },
      ]).blocked,
    ).toBe(true);
  });
});
