import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MemoryPage } from "./MemoryPage";
const state = vi.hoisted(() => ({
  scenario: "ready",
  mode: "cloud",
  enabled: [] as boolean[],
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: state.mode }),
}));
vi.mock("wasp/client/operations", () => ({
  getMemoryOverview: "overview",
  getMemoryFeed: "feed",
  deleteMemoryEntry: vi.fn(),
  retryMemoryEntry: vi.fn(),
  reviewMemoryFact: vi.fn(),
  updateMemoryEntry: vi.fn(),
  useQuery: (
    operation: string,
    args: { filter: string } | undefined,
    options: { enabled: boolean },
  ) => {
    state.enabled.push(options.enabled);
    const error =
      state.scenario === "failed" ||
      (operation === "overview" && state.scenario === "counts-failed");
    const loading = state.scenario === "loading";
    return {
      data:
        error || loading
          ? undefined
          : operation === "overview"
            ? { capturedToday: 1, reviewCount: 0, failedCount: 0 }
            : {
                filter: args!.filter,
                entries:
                  args!.filter === "all"
                    ? [
                        {
                          id: "qa-source",
                          rawText: "Synthetic original note.",
                          occurredAt: "2026-10-01T12:00:00Z",
                          processingStatus: "complete",
                          facts: [],
                        },
                      ]
                    : [],
                nextBefore: null,
              },
      isLoading: loading,
      isError: error,
      refetch: vi.fn(),
    };
  },
}));
function mount() {
  render(
    <MemoryRouter>
      <MemoryPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.scenario = "ready";
  state.mode = "cloud";
  state.enabled = [];
});
afterEach(cleanup);
describe("memory feed states", () => {
  it("shows an actual load error instead of an empty memory", () => {
    state.scenario = "failed";
    mount();
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn’t load your notes",
    );
    expect(
      screen.queryByText("Start with something worth keeping."),
    ).toBeNull();
  });
  it("does not invent zero counts or empty-state copy while loading", () => {
    state.scenario = "loading";
    mount();
    expect(screen.getByRole("status").textContent).toContain(
      "Loading your notes",
    );
    expect(
      screen.queryByText("Start with something worth keeping."),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Needs review" })).toBeTruthy();
  });
  it("keeps notes available when review counts fail", () => {
    state.scenario = "counts-failed";
    mount();
    expect(screen.getByText("Synthetic original note.")).toBeTruthy();
    expect(screen.getByText(/Review counts couldn’t load/)).toBeTruthy();
  });
  it("gives review-specific guidance and exposes the active filter", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Needs review/ }));
    expect(
      screen
        .getByRole("button", { name: /Needs review/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("Nothing waiting for review.")).toBeTruthy();
    expect(
      screen.queryByText("Start with something worth keeping."),
    ).toBeNull();
  });
  it.each(["local", "encrypted"])(
    "keeps cloud operations disabled in %s mode",
    (mode) => {
      state.mode = mode;
      mount();
      expect(state.enabled.every((value) => !value)).toBe(true);
      expect(screen.queryByText("Synthetic original note.")).toBeNull();
    },
  );
});
