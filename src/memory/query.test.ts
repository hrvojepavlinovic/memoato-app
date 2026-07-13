import { describe, expect, it } from "vitest";
import {
  acceptedMemoryFacts,
  isDerivedMemoryEvent,
  trustedFactsForEvent,
} from "./query";

describe("trusted external memory facts", () => {
  it("returns accepted normalized facts only", () => {
    const facts = acceptedMemoryFacts({
      rawMemoryFacts: [
        { id: "accepted", label: "weight", status: "accepted" },
        { id: "review", label: "sleep", status: "needs_review" },
        { id: "rejected", label: "pain", status: "rejected" },
      ],
    });

    expect(facts.map((fact) => fact.id)).toEqual(["accepted"]);
  });

  it("does not fall back to stale extraction data for raw notes", () => {
    expect(
      trustedFactsForEvent({
        kind: "NOTE",
        rawMemoryFacts: [],
        data: {
          memoatoMemory: {
            extraction: { facts: [{ label: "stale interpretation" }] },
          },
        },
      }),
    ).toEqual([]);
  });

  it("distinguishes derived sessions from legacy standalone sessions", () => {
    expect(isDerivedMemoryEvent({ data: { rawEntryId: "raw-1" } })).toBe(true);
    expect(
      trustedFactsForEvent({
        kind: "SESSION",
        data: { fact: { label: "legacy fact" } },
      }),
    ).toEqual([{ label: "legacy fact" }]);
  });
});
