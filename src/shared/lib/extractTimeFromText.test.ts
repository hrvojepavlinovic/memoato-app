import { describe, expect, it } from "vitest";
import { extractTimeFromText } from "./extractTimeFromText";

describe("extractTimeFromText", () => {
  it("extracts 24h time", () => {
    const out = extractTimeFromText("pull ups 30 at 20:00");
    expect(out).toEqual({ hour: 20, minute: 0, source: "20:00" });
  });

  it("extracts 12h time with minutes", () => {
    const out = extractTimeFromText("met at 10:20 am");
    expect(out).toEqual({ hour: 10, minute: 20, source: "10:20 am" });
  });

  it("extracts am/pm without minutes", () => {
    const out = extractTimeFromText("football 6pm");
    expect(out).toEqual({ hour: 18, minute: 0, source: "6pm" });
  });

  it("handles midnight and noon", () => {
    expect(extractTimeFromText("12am")?.hour).toBe(0);
    expect(extractTimeFromText("12pm")?.hour).toBe(12);
  });

  it("returns null when no time token is present", () => {
    expect(extractTimeFromText("300 push ups")).toBeNull();
  });
});

