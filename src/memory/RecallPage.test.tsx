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
import { RecallPage } from "./RecallPage";

const state = vi.hoisted(() => ({
  mode: "cloud",
  scenario: "ready",
  sourceText: "Synthetic note: the release review was useful.",
  enabled: [] as boolean[],
  answer: vi.fn(),
  update: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: state.mode }),
}));
vi.mock("wasp/client/operations", () => ({
  recallMemory: "recall",
  answerMemoryRecall: state.answer,
  updateMemoryEntry: state.update,
  reviewMemoryFact: vi.fn(),
  deleteMemoryEntry: vi.fn(),
  retryMemoryEntry: vi.fn(),
  useQuery: (
    _operation: unknown,
    args: { query: string; semantic: boolean },
    options: { enabled: boolean },
  ) => {
    state.enabled.push(options.enabled);
    const error =
      options.enabled &&
      (state.scenario === "failed" ||
        (args.semantic && state.scenario === "semantic-failed"));
    return {
      data:
        options.enabled && !error
          ? {
              query: args.query,
              count: 1,
              mode: args.semantic ? "hybrid" : "lexical",
              entries: [
                {
                  id: "source-qa",
                  rawText: state.sourceText,
                  source: "app",
                  occurredAt: "2026-10-01T12:00:00Z",
                  processingStatus:
                    state.scenario === "legacy" ? "legacy" : "complete",
                  facts: [],
                },
              ],
            }
          : undefined,
      isError: error,
      isLoading: false,
      isFetching: false,
      refetch: state.refetch,
    };
  },
}));
function mount() {
  return render(
    <MemoryRouter>
      <RecallPage />
    </MemoryRouter>,
  );
}
function search(value = "release") {
  fireEvent.change(screen.getByLabelText("What are you looking for?"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find" }));
}
function pendingAnswer() {
  let resolve!: (v: unknown) => void;
  state.answer.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  return resolve;
}
const answer = {
  available: true,
  answer: "A synthetic AI answer.",
  citations: ["source-qa"],
  confidence: "high",
};
beforeEach(() => {
  state.mode = "cloud";
  state.scenario = "ready";
  state.sourceText = "Synthetic note: the release review was useful.";
  state.enabled = [];
  state.answer.mockReset().mockResolvedValue(answer);
  state.update.mockReset().mockResolvedValue({});
  state.refetch.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("source-backed recall", () => {
  it("reports failed search rather than searching forever or claiming zero results", () => {
    state.scenario = "failed";
    mount();
    search();
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn’t load matching notes",
    );
    expect(screen.queryByText("Searching your notes…")).toBeNull();
    expect(screen.queryByText("No matching notes yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try search again" }));
    expect(state.refetch).toHaveBeenCalled();
  });
  it("retains lexical sources when semantic search fails", () => {
    state.scenario = "semantic-failed";
    mount();
    search();
    expect(
      screen.getByText("Synthetic note: the release review was useful."),
    ).toBeTruthy();
    expect(screen.getByText(/Meaning search is unavailable/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Answer from these notes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("discards an AI response from the previous question", async () => {
    const resolve = pendingAnswer();
    mount();
    search();
    fireEvent.click(
      screen.getByRole("button", { name: "Answer from these notes" }),
    );
    search("meeting");
    await act(async () => resolve(answer));
    expect(screen.queryByText(answer.answer)).toBeNull();
    expect(screen.getByText("For “meeting”")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Answer from these notes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("discards an AI response when its source is edited", async () => {
    const resolve = pendingAnswer();
    mount();
    search();
    fireEvent.click(
      screen.getByRole("button", { name: "Answer from these notes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit original" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Original note" }), {
      target: { value: "Updated synthetic source" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save original" }));
    await waitFor(() => expect(state.refetch).toHaveBeenCalled());
    await act(async () => resolve(answer));
    expect(screen.queryByText(answer.answer)).toBeNull();
  });
  it("discards an answer if background refresh replaces its source text", async () => {
    const resolve = pendingAnswer();
    const view = mount();
    search();
    fireEvent.click(
      screen.getByRole("button", { name: "Answer from these notes" }),
    );
    state.sourceText = "The source changed during processing.";
    view.rerender(
      <MemoryRouter>
        <RecallPage />
      </MemoryRouter>,
    );
    await act(async () => resolve(answer));
    expect(screen.queryByText(answer.answer)).toBeNull();
    expect(screen.getByText(state.sourceText)).toBeTruthy();
  });
  it("links answer citations to the corresponding visible source", async () => {
    mount();
    search();
    fireEvent.click(
      screen.getByRole("button", { name: "Answer from these notes" }),
    );
    await screen.findByText(answer.answer);
    const link = screen.getByRole("link", { name: /Source 1/ });
    expect(link.getAttribute("href")).toBe("#evidence-source-qa");
    expect(document.getElementById("evidence-source-qa")).toBeTruthy();
  });
  it("keeps imported results readable without offering unsupported AI synthesis", () => {
    state.scenario = "legacy";
    mount();
    search();
    expect(
      (
        screen.getByRole("button", {
          name: "Answer from these notes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Edit original" })).toBeNull();
  });
  it.each(["local", "encrypted"])(
    "does not run recall or expose cloud input in %s mode",
    (mode) => {
      state.mode = mode;
      mount();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(state.enabled.every((value) => !value)).toBe(true);
      expect(
        screen.getByRole("link", { name: /Open your views/ }),
      ).toBeTruthy();
      expect(state.answer).not.toHaveBeenCalled();
    },
  );
});
