import { describe, expect, it } from "vitest";
import { buildEmbeddingSearchText } from "./embeddingQueue";

describe("trusted embedding projection", () => {
  it("keeps raw evidence but excludes unreviewed and rejected facts", () => {
    const text = buildEmbeddingSearchText({
      rawText: "Original note",
      rawMemoryFacts: [
        { label: "accepted fact", status: "accepted" },
        { label: "unreviewed fact", status: "needs_review" },
        { label: "rejected fact", status: "rejected" },
      ],
    });

    expect(text).toContain("Original note");
    expect(text).toContain("accepted fact");
    expect(text).not.toContain("unreviewed fact");
    expect(text).not.toContain("rejected fact");
  });
});
