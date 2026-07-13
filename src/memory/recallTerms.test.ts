import { describe, expect, it } from "vitest";
import {
  buildPostgresTsQuery,
  parseRecallQuery,
  searchMemoryTerms,
} from "./recallTerms";

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
    expect(searchMemoryTerms("pull ups / zgibovi")).toEqual(["pull"]);
  });

  it("expands Croatian and English concepts into one search group", () => {
    const parsed = parseRecallQuery("nogomet i low energy");
    expect(parsed.terms).toEqual(["football", "energy"]);
    expect(parsed.groups[0]).toContain("football");
    expect(parsed.groups[0]).toContain("nogomet");
    expect(parsed.groups[1]).toContain("energija");
    expect(parsed.tsQuery).toContain("football:*");
    expect(parsed.tsQuery).toContain("nogomet:*");
  });

  it("extracts bilingual calendar ranges without turning them into terms", () => {
    const now = new Date(2026, 6, 13, 12, 0, 0);
    const hrvatski = parseRecallQuery("zgibovi prošli tjedan", now);
    const english = parseRecallQuery("weight last 30 days", now);
    expect(hrvatski.terms).toEqual(["pull"]);
    expect(hrvatski.range?.key).toBe("last_week");
    expect(hrvatski.range?.from.getDay()).toBe(1);
    expect(english.terms).toEqual(["weight"]);
    expect(english.range?.key).toBe("last_30_days");
    expect(english.range?.to.getDate()).toBe(14);
  });

  it("builds a safe prefix tsquery with OR aliases and AND concepts", () => {
    expect(buildPostgresTsQuery([["pull", "zgib"], ["pain"]])).toBe(
      "(pull:* | zgib:*) & (pain:*)",
    );
    expect(buildPostgresTsQuery([["bad'); DROP TABLE x;--"]])).toBe(
      "(baddroptablex:*)",
    );
  });
});
