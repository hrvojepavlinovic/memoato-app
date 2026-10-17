import { describe, expect, it } from "vitest";
import {
  categoryEntryLabel,
  formatDurationMinutes,
  normalizeCategoryAmount,
} from "./categoryEntrySemantics";

describe("binary category entry semantics", () => {
  it("always stores played DO sessions as one event", () => {
    expect(
      normalizeCategoryAmount({
        categoryType: "DO",
        requestedAmount: 45,
        scheduledStatus: "went",
      }),
    ).toBe(1);
  });

  it("preserves missed and cancelled simple tracking as zero", () => {
    expect(
      normalizeCategoryAmount({
        categoryType: "DO",
        requestedAmount: 45,
        scheduledStatus: "cancelled",
      }),
    ).toBe(0);
  });

  it("describes Football and Padel as played entries instead of amounts", () => {
    expect(categoryEntryLabel({ categorySlug: "football", amount: 1 })).toBe(
      "Played football",
    );
    expect(categoryEntryLabel({ categorySlug: "padel", amount: 1 })).toBe(
      "Played padel",
    );
  });

  it("formats a 105-minute session as one hour and 45 minutes", () => {
    expect(formatDurationMinutes(105)).toBe("1 h 45 min");
  });
});
