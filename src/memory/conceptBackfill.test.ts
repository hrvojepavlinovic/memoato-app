import { afterEach, describe, expect, it, vi } from "vitest";
import { backfillMemoryConcepts } from "./ingest";

describe("memory concept backfill", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("attaches a stable concept to an existing fact without replacing it", async () => {
    vi.useFakeTimers();
    const prisma: any = {
      memoryFact: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fact-1",
            userId: "user-1",
            rawEntryId: "entry-1",
            categoryId: null,
            position: 0,
            kind: "context",
            label: "Sleepover",
            canonical: "Sleepover",
            amount: null,
            unit: null,
            durationMinutes: null,
            confidence: 0.9,
            origin: "openrouter",
            data: { fact: { label: "Sleepover" } },
            rawEntry: { rawText: "Dijete je na prespavancu." },
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      memoryConcept: {
        upsert: vi.fn().mockResolvedValue({ id: "concept-1" }),
      },
      memoryConceptAlias: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      memoryEntryConcept: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction = vi.fn((callback: any) => callback(prisma));

    await expect(backfillMemoryConcepts(prisma)).resolves.toBe(1);
    expect(prisma.memoryFact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fact-1", conceptId: null },
        data: expect.objectContaining({ conceptId: "concept-1" }),
      }),
    );
    expect(prisma.memoryEntryConcept.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          rawEntryId: "entry-1",
          conceptId: "concept-1",
          role: "primary",
        }),
      }),
    );
  });
});
