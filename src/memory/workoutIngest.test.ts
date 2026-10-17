import { describe, expect, it } from "vitest";
import { parseCreateRawEntryRequest } from "./ingest";
import { factsForExerciseSetEvents, shouldProjectMemoryFact } from "./exercise";

describe("MCP workout contract", () => {
  it("accepts typed dimensions on one performed parent label", () => {
    const request = parseCreateRawEntryRequest({
      text: "Igrao sam nogomet.",
      labels: [
        {
          kind: "movement",
          label: "football",
          executionStatus: "performed",
          workout: {
            durationSeconds: 4022,
            distanceKm: 4.08,
            activeKcal: 876,
            totalKcal: 1016,
            averageHeartRateBpm: 162,
            minHeartRateBpm: 78,
            maxHeartRateBpm: 189,
            perceivedEffort: { value: 8, label: "Hard" },
          },
        },
      ],
    });
    expect(request.labels).toHaveLength(1);
    expect(request.labels?.[0]).toMatchObject({
      executionStatus: "performed",
      workout: { durationSeconds: 4022, activeKcal: 876, totalKcal: 1016 },
    });
    expect(shouldProjectMemoryFact(request.labels![0])).toBe(true);
    expect(factsForExerciseSetEvents(request.labels![0])).toHaveLength(1);
  });

  it("preserves but does not project planned workout metrics", () => {
    const request = parseCreateRawEntryRequest({
      text: "Sutra je planiran nogomet.",
      labels: [
        {
          kind: "movement",
          label: "football",
          executionStatus: "planned",
          workout: { durationSeconds: 3600 },
        },
      ],
    });
    expect(request.labels?.[0].workout?.durationSeconds).toBe(3600);
    expect(shouldProjectMemoryFact(request.labels![0])).toBe(false);
  });

  it("requires explicit performed status for a metric-bearing workout", () => {
    const request = parseCreateRawEntryRequest({
      text: "Nogomet 60 minuta.",
      labels: [
        {
          kind: "movement",
          label: "football",
          workout: { durationSeconds: 3600 },
        },
      ],
    });
    expect(shouldProjectMemoryFact(request.labels![0])).toBe(false);
  });
});
