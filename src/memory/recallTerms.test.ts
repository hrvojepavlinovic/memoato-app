import { describe, expect, it } from "vitest";
import { searchMemoryTerms } from "./recallTerms";

describe("searchMemoryTerms", () => {
  it("reduces a natural English question to searchable evidence", () => {
    expect(searchMemoryTerms("When did I last play football?")).toEqual([
      "football",
    ]);
  });

  it("normalizes Croatian questions and maps personal metric vocabulary", () => {
    expect(searchMemoryTerms("Koliko sam zadnji put imao kila?")).toEqual([
      "weight",
    ]);
    expect(searchMemoryTerms("Kad sam zadnji put radio zgibove?")).toEqual([
      "pull",
    ]);
  });
});
