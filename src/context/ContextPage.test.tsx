import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery as useRealQuery,
} from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ContextPage } from "./ContextPage";
import type { ContextOverview, ContextPacketView } from "./viewTypes";

const state = vi.hoisted(() => ({
  userRole: "admin",
  overview: vi.fn(),
  create: vi.fn(),
  connect: vi.fn(),
  sync: vi.fn(),
  review: vi.fn(),
  build: vi.fn(),
}));
vi.mock("wasp/client/auth", () => ({
  useAuth: () => ({ data: { id: "synthetic-user", role: state.userRole } }),
}));
vi.mock("wasp/client/operations", () => ({
  getContextOverview: "overview",
  createContextWorkspace: state.create,
  connectContextSource: state.connect,
  syncContextSource: state.sync,
  reviewContextClaim: state.review,
  buildContextPacket: state.build,
  useQuery: (
    operation: string,
    args: unknown,
    options: Record<string, unknown>,
  ) =>
    useRealQuery({
      queryKey: [operation, args],
      queryFn: () => state.overview(args),
      ...options,
    }),
}));
function overview(): ContextOverview {
  const workspace = {
    id: "project-1",
    name: "Example project",
    type: "project",
    role: "owner",
  };
  return {
    workspace,
    workspaces: [
      workspace,
      { ...workspace, id: "project-2", name: "Another project" },
    ],
    connections: [
      {
        id: "github-1",
        provider: "github",
        displayName: "Example sources",
        status: "active",
        lastSyncAt: null,
        lastSyncError: null,
        _count: { objects: 1 },
      },
    ],
    proposedClaims: [
      {
        id: "claim-1",
        kind: "release_decision",
        statement: "Keep the first release small.",
        freshUntil: "2099-01-01T00:00:00Z",
        evidence: [
          {
            role: "supports",
            excerpt: "Ship the smallest useful release.",
            sourceVersion: {
              contentHash: "hash-original-version",
              sourceUpdatedAt: null,
              sourceObject: {
                stableKey: "example/repo#12",
                canonicalUrl: "https://github.com/example/repo/issues/12",
                provider: "github",
              },
            },
          },
        ],
      },
    ],
    counts: { sourceObjects: 1, sourceVersions: 1, acceptedClaims: 1 },
    providers: { githubConfigured: true, linearConfigured: false },
  };
}
const packet: ContextPacketView = {
  id: "packet-1",
  traceId: "trace-1",
  packetHash: "packet-hash",
  permissionSnapshotHash: "grant-hash",
  content: {
    query: "release decisions",
    workspace: { id: "project-1", name: "Example project" },
    claims: [],
    freshness: { generatedAt: "2026-10-19T10:00:00Z", freshUntil: null },
    exclusions: { stale: 0, permission: 0 },
  },
  diff: { added: [], removed: [], changed: [], unchangedCount: 0 },
};
let client: QueryClient;
let data: ContextOverview;
beforeEach(() => {
  vi.clearAllMocks();
  state.userRole = "admin";
  data = overview();
  state.overview.mockImplementation(
    async ({ workspaceId }: { workspaceId?: string }) =>
      workspaceId === "project-2"
        ? { ...data, workspace: data.workspaces[1], proposedClaims: [] }
        : data,
  );
  state.create.mockResolvedValue({ id: "new-project" });
  state.connect.mockResolvedValue({});
  state.review.mockResolvedValue({});
  state.sync.mockResolvedValue({});
  state.build.mockResolvedValue(packet);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});
async function mount() {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContextPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.queryByText("Loading your workspace…")).toBeNull(),
  );
}
function openReview() {
  fireEvent.click(screen.getByRole("button", { name: "Review (1)" }));
}
function submitPacket() {
  fireEvent.click(screen.getByRole("button", { name: "Build context" }));
  const region = screen.getByRole("region", { name: "Build context" });
  fireEvent.change(within(region).getByRole("textbox"), {
    target: { value: "release decisions" },
  });
  fireEvent.click(
    within(region).getByRole("button", { name: "Build context" }),
  );
}
describe("Context operations and access", () => {
  it("shows a query error without offering to recreate the workspace", async () => {
    state.overview.mockRejectedValue(new Error("Unavailable"));
    await mount();
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn’t load Context",
    );
    expect(
      screen.queryByRole("button", { name: "Create workspace" }),
    ).toBeNull();
  });
  it("preserves a failed workspace draft and prevents duplicate creation", async () => {
    data = { ...data, workspace: null, workspaces: [] };
    state.create.mockRejectedValue(new Error("Failed"));
    await mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
      target: { value: "My project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "My project",
    );
    let reject!: (reason: Error) => void;
    state.create.mockImplementation(
      () =>
        new Promise((_, failure) => {
          reject = failure;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Creating workspace…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => reject(new Error("Failed again")));
    expect(state.create).toHaveBeenCalledTimes(2);
  });
  it("separates workspace review rights from administrator-only source setup", async () => {
    state.userRole = "user";
    await mount();
    expect(screen.queryByRole("button", { name: "Add a source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sync source" })).toBeNull();
    openReview();
    expect(
      (
        screen.getByRole("button", {
          name: "Accept claim",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("lets members inspect evidence but not review it", async () => {
    data.workspace!.role = "member";
    await mount();
    openReview();
    expect(
      (
        screen.getByRole("button", {
          name: "Accept claim",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Ship the smallest useful release.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /example\/repo#12/ })
        .getAttribute("href"),
    ).toBe("https://github.com/example/repo/issues/12");
  });
  it("preserves connector drafts on failure and sends only the explicit repository scope", async () => {
    state.connect.mockRejectedValue(
      new Error("Repository is not allowlisted."),
    );
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "GitHub organization" }),
      { target: { value: "example" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Repository names" }),
      { target: { value: "one\ntwo\none" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));
    await screen.findByRole("alert");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Repository names",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("one\ntwo\none");
    expect(state.connect).toHaveBeenCalledWith({
      workspaceId: "project-1",
      provider: "github",
      displayName: "example",
      config: {
        organization: "example",
        repositories: ["one", "two"],
        takePerRepository: 50,
      },
    });
  });
  it("does not enable an unconfigured provider", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    fireEvent.click(screen.getByRole("button", { name: "Linear" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Connect Linear",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/Linear setup is not available yet/)).toBeTruthy();
    expect(state.connect).not.toHaveBeenCalled();
  });
  it("locks other writes and workspace switching while a sync is pending", async () => {
    let resolve!: () => void;
    state.sync.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Sync source" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Another project owner",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    openReview();
    expect(
      (
        screen.getByRole("button", {
          name: "Accept claim",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Accept claim" }));
    expect(state.review).not.toHaveBeenCalled();
    await act(async () => resolve());
    await waitFor(() => expect(screen.getByText(/Sync complete/)).toBeTruthy());
  });
  it("keeps the source and exposes a failed review", async () => {
    state.review.mockRejectedValue(new Error("Review failed."));
    await mount();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "Reject claim" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Keep the first release small.")).toBeTruthy();
    expect(state.review).toHaveBeenCalledWith({
      workspaceId: "project-1",
      claimId: "claim-1",
      action: "reject",
    });
  });
  it("keeps expired proposals reviewable without accepting stale evidence", async () => {
    data.proposedClaims[0].freshUntil = "2000-01-01T00:00:00Z";
    await mount();
    openReview();
    expect(
      (
        screen.getByRole("button", {
          name: "Accept claim",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Reject claim",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.getByText(/This evidence has expired/)).toBeTruthy();
  });
  it("keeps the query and shows a recoverable packet failure", async () => {
    state.build.mockRejectedValue(new Error("Build failed."));
    await mount();
    submitPacket();
    await screen.findByRole("alert");
    expect(
      (
        screen.getByRole("textbox", {
          name: "What do you need context for?",
        }) as HTMLInputElement
      ).value,
    ).toBe("release decisions");
    expect(screen.queryByRole("region", { name: "Context packet" })).toBeNull();
  });
  it("keeps a confirmed save visible if refreshing then fails", async () => {
    await mount();
    state.overview.mockRejectedValue(new Error("Refresh failed."));
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "Accept claim" }));
    await screen.findByRole("alert");
    expect(
      screen.getByText("Claim accepted with its source evidence."),
    ).toBeTruthy();
  });
  it("invalidates a packet when its query changes", async () => {
    await mount();
    submitPacket();
    await screen.findByRole("region", { name: "Context packet" });
    fireEvent.change(
      screen.getByRole("textbox", { name: "What do you need context for?" }),
      { target: { value: "new question" } },
    );
    expect(screen.queryByRole("region", { name: "Context packet" })).toBeNull();
  });
  it("discards a pending packet after background evidence refresh", async () => {
    let resolve!: (value: ContextPacketView) => void;
    state.build.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount();
    submitPacket();
    await act(async () => {
      await client.invalidateQueries();
    });
    await act(async () => resolve(packet));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Context packet" }),
      ).toBeNull(),
    );
  });
  it("removes a packet when switching workspaces", async () => {
    await mount();
    submitPacket();
    await screen.findByRole("region", { name: "Context packet" });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Another project owner",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Another project owner" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Another project owner" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(screen.queryByRole("region", { name: "Context packet" })).toBeNull();
  });
});
