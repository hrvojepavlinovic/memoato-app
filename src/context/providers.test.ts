import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextProviderError, fetchConnectionRecords } from "./providers";

const originalGitHubToken = process.env.GITHUB_CONTEXT_TOKEN;
const originalLinearToken = process.env.LINEAR_CONTEXT_API_KEY;

afterEach(() => {
  if (originalGitHubToken === undefined) {
    delete process.env.GITHUB_CONTEXT_TOKEN;
  } else {
    process.env.GITHUB_CONTEXT_TOKEN = originalGitHubToken;
  }
  if (originalLinearToken === undefined) {
    delete process.env.LINEAR_CONTEXT_API_KEY;
  } else {
    process.env.LINEAR_CONTEXT_API_KEY = originalLinearToken;
  }
  vi.restoreAllMocks();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GitHub context provider", () => {
  it("reads only selected repositories and proposes evidence-bound state claims", async () => {
    process.env.GITHUB_CONTEXT_TOKEN = "test-read-only-token";
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      jsonResponse([
        {
          id: 101,
          node_id: "PR_node_101",
          number: 42,
          title: "Ship trustworthy context",
          body: "Permission filter first.",
          state: "open",
          draft: false,
          updated_at: "2026-07-13T18:00:00.000Z",
          html_url: "https://github.com/memoato/app/pull/42",
          user: { login: "hrvoje" },
          labels: [{ name: "context" }],
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      ]),
    );

    const records = await fetchConnectionRecords({
      connection: {
        provider: "github",
        credentialRef: "env:GITHUB_CONTEXT_TOKEN",
        permissionVersion: 3,
        config: {
          organization: "memoato",
          repositories: ["app"],
          takePerRepository: 10,
        },
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/repos/memoato/app/pulls",
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: "github",
      objectType: "pull_request",
      stableKey: "github:memoato/app:pull:42",
      sourcePermissionVersion: 3,
    });
    expect(records[0]?.proposedClaims[0]).toMatchObject({
      claimKey: "github:memoato/app:pull:42:state",
      kind: "delivery.pull_request_state",
      confidence: 1,
    });
  });
});

describe("Linear context provider", () => {
  it("turns a bounded team issue response into an immutable source candidate", async () => {
    process.env.LINEAR_CONTEXT_API_KEY = "test-read-only-token";
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          team: {
            id: "team-1",
            name: "Memoato",
            issues: {
              nodes: [
                {
                  id: "issue-1",
                  identifier: "MEM-12",
                  title: "Review evidence policy",
                  description: "Review before migration.",
                  url: "https://linear.app/memoato/issue/MEM-12",
                  priority: 1,
                  createdAt: "2026-07-12T18:00:00.000Z",
                  updatedAt: "2026-07-13T18:00:00.000Z",
                  state: { id: "state-1", name: "In Review", type: "started" },
                  labels: { nodes: [] },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      }),
    );

    const records = await fetchConnectionRecords({
      connection: {
        provider: "linear",
        credentialRef: "env:LINEAR_CONTEXT_API_KEY",
        permissionVersion: 2,
        config: { teamId: "team-1", teamName: "Memoato", take: 20 },
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(records[0]).toMatchObject({
      provider: "linear",
      objectType: "issue",
      stableKey: "linear:team-1:issue:issue-1",
      sourcePermissionVersion: 2,
    });
    expect(records[0]?.proposedClaims[0]?.statement).toContain(
      "MEM-12 “Review evidence policy” is In Review",
    );
  });

  it("does not treat GraphQL errors in a 200 response as source data", async () => {
    process.env.LINEAR_CONTEXT_API_KEY = "test-read-only-token";
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ message: "Forbidden" }] }),
    );

    await expect(
      fetchConnectionRecords({
        connection: {
          provider: "linear",
          credentialRef: "env:LINEAR_CONTEXT_API_KEY",
          permissionVersion: 1,
          config: { teamId: "team-1", teamName: "Memoato", take: 20 },
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ContextProviderError>>({
        code: "linear_graphql_error",
      }),
    );
  });
});
