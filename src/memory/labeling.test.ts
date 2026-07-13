import { describe, expect, it } from "vitest";
import {
  ensureLabeledMemoryExtraction,
  extractCatalogMemoryFacts,
  normalizeMemoryFactLabel,
  primaryMemoryLabel,
} from "./labeling";

describe("stable memory labels", () => {
  it("labels Croatian family context without a generative AI call", () => {
    const result = extractCatalogMemoryFacts(
      "Example child je ostala na prespavancu u Kaštelima.",
    );
    expect(result.facts).toEqual([
      expect.objectContaining({
        conceptKey: "family.sleepover",
        domain: "family",
        canonical: "Sleepover",
      }),
    ]);
  });

  it("labels subjective work notes as a stable work reflection", () => {
    const result = extractCatalogMemoryFacts(
      "Tilt je najgora firma za radit ikad.",
    );
    expect(result.facts[0]).toEqual(
      expect.objectContaining({
        conceptKey: "work.reflection",
        domain: "work",
        canonical: "Work reflection",
      }),
    );
  });

  it("always gives an unmatched raw note a safe human-readable label", () => {
    const result = ensureLabeledMemoryExtraction("Nešto moje.", {
      parser: "deterministic",
      parserVersion: "test",
      facts: [],
      unknowns: [],
    });
    expect(result.facts).toEqual([
      expect.objectContaining({
        conceptKey: "personal.note",
        domain: "personal",
        canonical: "Life note",
      }),
    ]);
    expect(primaryMemoryLabel(result.facts).label).toBe("Life note");
  });

  it("normalizes Croatian and English aliases to one language-neutral key", () => {
    const hrvatski = normalizeMemoryFactLabel({
      kind: "movement",
      label: "zgibovi",
      confidence: 0.9,
    });
    const english = normalizeMemoryFactLabel({
      kind: "movement",
      label: "pull ups",
      confidence: 0.9,
    });
    expect(hrvatski.conceptKey).toBe("movement.pull_ups");
    expect(english.conceptKey).toBe(hrvatski.conceptKey);
  });
});
