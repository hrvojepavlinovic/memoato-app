import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NewCategoryPage } from "./NewCategoryPage";
const mock = vi.hoisted(() => ({ create: vi.fn(), templates: [] }));
vi.mock("wasp/client/operations", () => ({
  createCategory: mock.create,
  getCategoryTemplates: "templates",
  useQuery: () => ({ data: mock.templates }),
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: "cloud", key: null }),
}));
afterEach(cleanup);
beforeEach(() => {
  mock.create.mockReset();
  mock.create.mockRejectedValue(new Error("Offline. Try again."));
});
function mount() {
  render(
    <MemoryRouter>
      <NewCategoryPage />
    </MemoryRouter>,
  );
}
describe("View creation", () => {
  it("sends the chosen chart, period and aggregation and retains failed drafts", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Reading" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    fireEvent.click(screen.getByRole("radio", { name: "Average" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByRole("alert");
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reading",
        categoryType: "NUMBER",
        chartType: "bar",
        period: "month",
        bucketAggregation: "avg",
      }),
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Reading",
    );
    expect(
      (screen.getByRole("radio", { name: "Month" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
  it("keeps chart-specific fields disabled when a trend has no bucket period", () => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Line" }));
    expect(
      screen.getByRole("radio", { name: "Week" }).closest("fieldset")?.disabled,
    ).toBe(true);
    expect(screen.getByRole("radio", { name: "Latest" })).toBeTruthy();
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("does not submit a second create while the first is pending", async () => {
    let finish!: (value: any) => void;
    mock.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Reading" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Creating…" }));
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Title").closest("fieldset")?.disabled).toBe(
      true,
    );
    finish({ id: "reading", slug: "reading" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create" })).toBeTruthy(),
    );
  });
});
