import { describe, expect, it } from "vitest";
import {
  diffContextClaims,
  filterContextClaimsBeforeRanking,
  isMaterializedGrantCurrent,
  rankContextClaims,
} from "./packet";

function claim(args: {
  id: string;
  statement: string;
  evidence: string[];
  freshUntil?: Date | null;
}) {
  return {
    id: args.id,
    claimKey: `claim:${args.id}`,
    kind: "delivery.state",
    statement: args.statement,
    status: "accepted",
    confidence: 1,
    freshUntil: args.freshUntil ?? null,
    evidence: args.evidence.map((sourceVersionId) => ({ sourceVersionId })),
  };
}

describe("trust eval: permission leakage", () => {
  it("removes a mixed-evidence claim before ranking sees its secret text", () => {
    const visible = claim({
      id: "visible",
      statement: "Public delivery update",
      evidence: ["version-visible"],
    });
    const mixed = claim({
      id: "mixed",
      statement: "LEAK_SENTINEL confidential acquisition",
      evidence: ["version-visible", "version-denied"],
    });

    const filtered = filterContextClaimsBeforeRanking({
      claims: [visible, mixed],
      allowedVersionIds: new Set(["version-visible"]),
      now: new Date("2026-07-13T20:00:00.000Z"),
    });
    const ranked = rankContextClaims(
      filtered.allowed,
      "LEAK_SENTINEL acquisition",
    );

    expect(filtered.permissionExcludedCount).toBe(1);
    expect(filtered.allowed.map((item) => item.id)).toEqual(["visible"]);
    expect(ranked).toEqual([]);
    expect(JSON.stringify(ranked)).not.toContain("LEAK_SENTINEL");
  });

  it("fails closed when a claim has no evidence", () => {
    const filtered = filterContextClaimsBeforeRanking({
      claims: [
        claim({ id: "unsupported", statement: "No receipt", evidence: [] }),
      ],
      allowedVersionIds: new Set(["version-visible"]),
      now: new Date("2026-07-13T20:00:00.000Z"),
    });

    expect(filtered.allowed).toEqual([]);
    expect(filtered.permissionExcludedCount).toBe(1);
  });

  it("fails closed when a materialized object grant has a stale epoch", () => {
    expect(
      isMaterializedGrantCurrent({
        connectionPermissionVersion: 1,
        connectionAccessPermissionVersion: 4,
        sourceConnectionAccess: {
          permissionVersion: 5,
          sourceConnection: { permissionVersion: 2 },
        },
      }),
    ).toBe(false);
  });
});

describe("trust eval: stale context", () => {
  it("excludes stale accepted claims while retaining fresh accepted claims", () => {
    const now = new Date("2026-07-13T20:00:00.000Z");
    const filtered = filterContextClaimsBeforeRanking({
      claims: [
        claim({
          id: "stale",
          statement: "Issue is in progress",
          evidence: ["version-stale"],
          freshUntil: new Date("2026-07-13T19:59:59.000Z"),
        }),
        claim({
          id: "fresh",
          statement: "Issue is done",
          evidence: ["version-fresh"],
          freshUntil: new Date("2026-07-14T20:00:00.000Z"),
        }),
      ],
      allowedVersionIds: new Set(["version-stale", "version-fresh"]),
      now,
    });

    expect(filtered.allowed.map((item) => item.id)).toEqual(["fresh"]);
    expect(filtered.staleExcludedCount).toBe(1);
  });
});

describe("context packet memory diff", () => {
  it("reports changed claim versions without copying source payloads", () => {
    const diff = diffContextClaims(
      [
        { claimId: "old-state", claimKey: "linear:issue-1:state" },
        { claimId: "unchanged", claimKey: "github:repo:pull:2:state" },
      ],
      [
        { claimId: "new-state", claimKey: "linear:issue-1:state" },
        { claimId: "unchanged", claimKey: "github:repo:pull:2:state" },
      ],
    );

    expect(diff).toEqual({
      added: [],
      removed: [],
      changed: [
        {
          claimKey: "linear:issue-1:state",
          previousClaimId: "old-state",
          claimId: "new-state",
        },
      ],
      unchangedCount: 1,
    });
  });
});
