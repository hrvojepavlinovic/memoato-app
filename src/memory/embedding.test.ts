import { describe, expect, it } from "vitest";
import {
  EmbeddingError,
  embeddingRequestTimeoutMs,
  normalizeEmbeddingResponse,
  toPgVector,
} from "./embedding";
import {
  buildEmbeddingSearchText,
  embeddingContentHash,
} from "./embeddingQueue";

describe("Memoato embeddings", () => {
  it("accepts only finite vectors with the configured dimensions", () => {
    expect(
      normalizeEmbeddingResponse({ data: [{ embedding: [0.1, -0.2] }] }, 2),
    ).toEqual([0.1, -0.2]);
    expect(() =>
      normalizeEmbeddingResponse({ data: [{ embedding: [0.1] }] }, 2),
    ).toThrow(EmbeddingError);
    expect(() => toPgVector([0.1, Number.NaN], 2)).toThrow(EmbeddingError);
  });

  it("serializes a validated pgvector parameter", () => {
    expect(toPgVector([0.1, -0.2, 0], 3)).toBe("[0.1,-0.2,0]");
  });

  it("allows slower background indexing without slowing interactive Recall", () => {
    expect(embeddingRequestTimeoutMs("search_query")).toBe(2_000);
    expect(embeddingRequestTimeoutMs("search_document")).toBe(30_000);
  });

  it("projects raw evidence and non-rejected facts deterministically", () => {
    const text = buildEmbeddingSearchText({
      rawText: "Zgibovi 2 2 3",
      rawMemoryFacts: [
        {
          label: "pull ups",
          canonical: "pull",
          amount: 7,
          unit: "reps",
          status: "accepted",
          data: {
            fact: { domain: "movement", conceptKey: "movement.pull_ups" },
          },
        },
        { label: "wrong", status: "rejected" },
      ],
    });
    expect(text).toContain("Zgibovi 2 2 3");
    expect(text).toContain(
      "pull ups · pull · movement · movement.pull_ups · 7 · reps",
    );
    expect(text).not.toContain("wrong");
    expect(embeddingContentHash(text)).toHaveLength(64);
    expect(embeddingContentHash(text)).toBe(embeddingContentHash(text));
  });
});
