import { describe, expect, it, vi } from "vitest";
import { persistSourceRecord } from "./ingest";
import type { ExternalSourceRecord } from "./types";

vi.mock("wasp/server", () => ({
  HttpError: class HttpError extends Error {},
}));

function record(state: string): ExternalSourceRecord {
  return {
    provider: "linear",
    objectType: "issue",
    externalId: "issue-1",
    stableKey: "linear:team-1:issue:issue-1",
    canonicalUrl: "https://linear.app/memoato/issue/MEM-1",
    upstreamScope: "team-1",
    externalVersion: `2026-07-13:${state}`,
    sourceUpdatedAt: new Date("2026-07-13T20:00:00.000Z"),
    rawPayload: { id: "issue-1", state },
    normalizedText: `MEM-1 ${state}`,
    sourcePermissionVersion: 2,
    proposedClaims: [
      {
        claimKey: "linear:issue-1:state",
        kind: "delivery.issue_state",
        statement: `MEM-1 is ${state}.`,
        confidence: 1,
        policyVersion: "connector-claims-v1",
      },
    ],
  };
}

describe("versioned source persistence", () => {
  it("is idempotent for equal raw content and appends changed content", async () => {
    const versions: Array<{
      id: string;
      ordinal: number;
      contentHash: string;
    }> = [];
    const sourceVersionCreate = vi.fn(
      async ({ data }: { data: { ordinal: number; contentHash: string } }) => {
        const version = {
          id: `version-${versions.length + 1}`,
          ordinal: data.ordinal,
          contentHash: data.contentHash,
        };
        versions.push(version);
        return version;
      },
    );
    const claimCreate = vi.fn(async () => ({ id: "claim" }));
    const tx = {
      sourceConnectionAccess: {
        findMany: vi.fn(async () => [
          {
            id: "connection-access-1",
            workspaceMemberId: "member-1",
            permissionVersion: 4,
          },
        ]),
      },
      sourceObjectAccess: {
        upsert: vi.fn(
          async (_args: {
            create: {
              connectionPermissionVersion: number;
              connectionAccessPermissionVersion: number;
            };
          }) => ({}),
        ),
      },
      sourceObject: {
        upsert: vi.fn(async () => ({ id: "object-1" })),
      },
      sourceVersion: {
        findFirst: vi.fn(async () => versions.at(-1) ?? null),
        create: sourceVersionCreate,
      },
      claimEvidence: { findFirst: vi.fn(async () => null) },
      claim: {
        findFirst: vi.fn(async () => null),
        create: claimCreate,
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const connection = {
      id: "connection-1",
      workspaceId: "workspace-1",
      permissionVersion: 2,
    };

    const first = await persistSourceRecord({
      prisma,
      connection,
      record: record("started"),
    });
    const retry = await persistSourceRecord({
      prisma,
      connection,
      record: record("started"),
    });
    const changed = await persistSourceRecord({
      prisma,
      connection,
      record: record("completed"),
    });

    expect(first).toMatchObject({ createdVersion: true, proposedClaims: 1 });
    expect(retry).toMatchObject({ createdVersion: false, proposedClaims: 0 });
    expect(changed).toMatchObject({ createdVersion: true, proposedClaims: 1 });
    expect(sourceVersionCreate).toHaveBeenCalledTimes(2);
    expect(sourceVersionCreate.mock.calls[1]?.[0].data).toMatchObject({
      previousVersionId: "version-1",
      ordinal: 2,
    });
    expect(claimCreate).toHaveBeenCalledTimes(2);
    expect(tx.sourceObjectAccess.upsert).toHaveBeenCalledTimes(3);
    expect(
      tx.sourceObjectAccess.upsert.mock.calls[0]?.[0].create,
    ).toMatchObject({
      connectionPermissionVersion: 2,
      connectionAccessPermissionVersion: 4,
    });
  });
});
