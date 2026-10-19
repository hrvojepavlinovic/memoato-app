import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery as useRealQuery,
} from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MemoryPage } from "./MemoryPage";

const state = vi.hoisted(() => ({ status: "complete" }));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: "cloud" }),
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
    options: Record<string, unknown>,
  ) =>
    useRealQuery({
      queryKey: [operation, args],
      queryFn: async () =>
        operation === "overview"
          ? { capturedToday: 1, reviewCount: 0, failedCount: 0 }
          : {
              filter: args!.filter,
              entries: [
                {
                  id: "poll-source",
                  rawText: "Original from the real query observer.",
                  occurredAt: "2026-10-19T10:00:00Z",
                  processingStatus: state.status,
                  facts: [],
                },
              ],
              nextBefore: null,
            },
      ...options,
    }),
}));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe("Memory with the installed query observer", () => {
  it.each(["complete", "queued", "processing"])(
    "renders %s notes across the initial undefined-data callback",
    async (status) => {
      state.status = status;
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <MemoryPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() =>
        expect(
          screen.getByText("Original from the real query observer."),
        ).toBeTruthy(),
      );
      expect(screen.queryByText("Loading your notes…")).toBeNull();
    },
  );
});
