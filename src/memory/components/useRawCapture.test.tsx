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
import { useRawCapture } from "./useRawCapture";

const mocks = vi.hoisted(() => ({ save: vi.fn(), invalidate: vi.fn() }));
vi.mock("wasp/client/operations", () => ({
  createRawLog: mocks.save,
  queryClientInitialized: Promise.resolve({
    invalidateQueries: mocks.invalidate,
  }),
}));

function Probe() {
  const capture = useRawCapture();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void capture.save();
      }}
    >
      <textarea
        aria-label="Note"
        value={capture.text}
        onChange={(event) => capture.updateText(event.target.value)}
      />
      <button type="submit">Save</button>
      <p role="status">{capture.saving ? "Saving" : capture.notice}</p>
      <p role="alert">{capture.error}</p>
    </form>
  );
}
function draft(value = "  A note worth keeping  ") {
  fireEvent.change(screen.getByLabelText("Note"), { target: { value } });
}
function submit() {
  fireEvent.click(screen.getByText("Save"));
}
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.save.mockReset();
  mocks.invalidate.mockReset();
  mocks.invalidate.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("raw capture durability", () => {
  it("keeps a failed draft and offers recovery without refreshing", async () => {
    mocks.save.mockRejectedValue(new Error("Network"));
    render(<Probe />);
    draft();
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Check Memory"),
    );
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
      "  A note worth keeping  ",
    );
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("does not duplicate a pending write and preserves typing during that write", async () => {
    const pending = deferred();
    mocks.save.mockReturnValue(pending.promise);
    render(<Probe />);
    draft("First note");
    submit();
    submit();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    draft("The next thought");
    await act(async () => {
      pending.resolve({ rawEntryId: "raw-1" });
    });
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
      "The next thought",
    );
    expect(screen.getByRole("status").textContent).toContain("Original saved");
  });

  it("distinguishes a saved original from a failed refresh", async () => {
    mocks.save.mockResolvedValue({ rawEntryId: "raw-1" });
    mocks.invalidate.mockRejectedValue(new Error("Refresh failed"));
    render(<Probe />);
    draft();
    submit();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "don’t need to save again",
      ),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith({
      text: "A note worth keeping",
    });
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(screen.getByRole("alert").textContent).toBe("");
  });

  it("clears a successfully saved draft and ignores whitespace-only input", async () => {
    mocks.save.mockResolvedValue({ rawEntryId: "raw-1" });
    render(<Probe />);
    draft("   ");
    submit();
    expect(mocks.save).not.toHaveBeenCalled();
    draft();
    submit();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Original saved",
      ),
    );
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(mocks.invalidate).toHaveBeenCalledTimes(3);
  });
});
