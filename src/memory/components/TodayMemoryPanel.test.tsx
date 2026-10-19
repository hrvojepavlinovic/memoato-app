import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TodayMemoryPanel } from "./TodayMemoryPanel";

const state = vi.hoisted(() => ({
  mode: "cloud",
  query: {} as Record<string, unknown>,
  save: vi.fn(),
}));
vi.mock("wasp/client/operations", () => ({
  getMemoryOverview: "overview",
  useQuery: () => state.query,
  createRawLog: state.save,
  queryClientInitialized: Promise.resolve({
    invalidateQueries: async () => {},
  }),
}));
vi.mock("../../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: state.mode }),
}));
afterEach(() => {
  cleanup();
  state.mode = "cloud";
  state.query = {};
  state.save.mockReset();
});
function mount(open = vi.fn()) {
  render(
    <MemoryRouter>
      <TodayMemoryPanel onOpenLegacyCapture={open} />
    </MemoryRouter>,
  );
  return open;
}

describe("Today capture availability", () => {
  it("does not display fake zero counts or an empty-state prompt while loading", () => {
    state.query = { isLoading: true };
    mount();
    expect(
      screen
        .getAllByRole("status")
        .map((node) => node.textContent)
        .join(" "),
    ).toContain("Loading recent notes");
    expect(screen.queryByText(/notes today|first note starts/)).toBeNull();
    expect(
      screen.getByLabelText("What would you like to remember?"),
    ).toBeTruthy();
  });
  it("keeps capture usable when recent memory cannot load", () => {
    state.query = { isError: true };
    mount();
    expect(screen.getByRole("alert").textContent).toContain(
      "still write a new one",
    );
    expect(screen.getByRole("button", { name: "Save note" })).toBeTruthy();
  });
  it.each(["local", "encrypted"])(
    "preserves the private capture path in %s mode",
    (mode) => {
      state.mode = mode;
      const open = mount();
      expect(screen.queryByRole("textbox")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Capture privately" }),
      );
      expect(open).toHaveBeenCalledOnce();
      expect(state.save).not.toHaveBeenCalled();
    },
  );
});
