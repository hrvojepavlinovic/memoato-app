import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OnboardingPage } from "./OnboardingPage";

const mocks = vi.hoisted(() => ({ create: vi.fn(), done: vi.fn() }));
vi.mock("wasp/client/operations", () => ({
  createCategory: mocks.create,
  ensureDefaultCategories: async () => {},
  getCategories: "categories",
  getCategoryTemplates: "templates",
  useQuery: (operation: string) => ({
    data:
      operation === "templates"
        ? [
            {
              key: "water",
              title: "Water",
              unit: "ml",
              period: "day",
              chartType: "bar",
              categoryType: "NUMBER",
              accentHex: "#26372f",
            },
          ]
        : [],
    isSuccess: true,
  }),
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: "cloud" }),
}));
vi.mock("./progress", () => ({ completeOnboarding: mocks.done }));

function mount() {
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<p>Today destination</p>} />
        <Route path="/context" element={<p>Context destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mocks.create.mockReset();
  mocks.done.mockReset();
});
afterEach(cleanup);

describe("first visit", () => {
  it.each([
    ["Start with a note", "Today destination"],
    ["Explore Context for AI", "Context destination"],
  ])("opens %s without creating trackers", async (action, destination) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(action) }));
    expect(await screen.findByText(destination)).toBeTruthy();
    expect(mocks.done).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("starts with no optional views and lets the last selected view be deselected", () => {
    mount();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Select views to add",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("keeps failed setup on screen and still allows starting with a note", async () => {
    mocks.create.mockRejectedValue(new Error("Network"));
    mount();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add 1 view and continue" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn’t finish",
      ),
    );
    expect(mocks.done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Start with a note/ }));
    expect(await screen.findByText("Today destination")).toBeTruthy();
  });
});
