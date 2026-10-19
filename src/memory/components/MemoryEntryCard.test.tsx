import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MemoryEntryCard } from "./MemoryEntryCard";
import type { MemoryRecord } from "../viewTypes";

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  retry: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("wasp/client/operations", () => ({
  reviewMemoryFact: mocks.review,
  retryMemoryEntry: mocks.retry,
  updateMemoryEntry: mocks.update,
  deleteMemoryEntry: mocks.remove,
}));
const original = "Synthetic note: two sets after a walk.";
function entry(): MemoryRecord {
  return {
    id: "note-qa",
    rawText: original,
    occurredAt: "2026-10-01T12:00:00Z",
    processingStatus: "complete",
    source: "app",
    facts: [
      {
        id: "fact-qa",
        label: "Walking",
        canonical: "Walking",
        amount: 5,
        unit: "min",
        status: "needs_review",
        origin: "openrouter",
        confidence: 0.8,
        data: { fact: { setValues: [2, 3] } },
      },
    ],
  };
}
function mount(record = entry(), onChanged = vi.fn()) {
  render(
    <MemoryRouter>
      <MemoryEntryCard entry={record} onChanged={onChanged} />
    </MemoryRouter>,
  );
  return onChanged;
}
beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset().mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("memory review", () => {
  it("keeps the original and reports a failed review", async () => {
    mocks.review.mockRejectedValue(new Error("Offline"));
    const changed = mount();
    fireEvent.click(screen.getByRole("button", { name: "Keep fact" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Couldn’t confirm",
    );
    expect(screen.getByText(original)).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });
  it("validates numeric corrections and allows clearing a value", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit fact" }));
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "not a number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save fact" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a number");
    expect(mocks.review).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save fact" }));
    await waitFor(() =>
      expect(mocks.review).toHaveBeenCalledWith({
        factId: "fact-qa",
        action: "edit",
        amount: null,
      }),
    );
  });
  it("changes a label without collapsing unchanged set values", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit fact" }));
    fireEvent.change(screen.getByLabelText("Label"), {
      target: { value: "Training effort" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save fact" }));
    await waitFor(() =>
      expect(mocks.review).toHaveBeenCalledWith({
        factId: "fact-qa",
        action: "edit",
        label: "Training effort",
        canonical: "Training effort",
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("accepts decimal commas without sending an invalid number", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit fact" }));
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "2,5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save fact" }));
    await waitFor(() =>
      expect(mocks.review).toHaveBeenCalledWith({
        factId: "fact-qa",
        action: "edit",
        amount: 2.5,
      }),
    );
  });
  it("preserves an original draft after failed update", async () => {
    mocks.update.mockRejectedValue(new Error("Offline"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit original" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Original note" }), {
      target: { value: "A corrected synthetic note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save original" }));
    await screen.findByRole("alert");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Original note",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("A corrected synthetic note");
  });
  it("distinguishes a confirmed change from a failed refresh", async () => {
    mount(entry(), vi.fn().mockRejectedValue(new Error("Refresh failed")));
    fireEvent.click(screen.getByRole("button", { name: "Keep fact" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Fact saved. Your original is unchanged. The list couldn’t refresh",
      ),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.review).toHaveBeenCalledTimes(1);
  });
  it("does not submit overlapping changes", async () => {
    let resolve!: () => void;
    mocks.review.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Keep fact" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss fact" }));
    expect(mocks.review).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
  it("treats imported events as read-only and preserves delete confirmation", () => {
    const record = entry();
    record.processingStatus = "legacy";
    record.facts![0].id = "event:legacy-qa";
    mount(record);
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("reports failed reprocessing while leaving the original visible", async () => {
    mocks.retry.mockRejectedValue(new Error("Offline"));
    const record = entry();
    record.processingStatus = "failed";
    mount(record);
    fireEvent.click(screen.getByRole("button", { name: "Retry processing" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Couldn’t confirm",
    );
    expect(screen.getByText(original)).toBeTruthy();
  });
});
