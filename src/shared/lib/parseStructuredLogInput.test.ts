import { describe, expect, it } from "vitest";
import { parseStructuredLogInput } from "./parseStructuredLogInput";

describe("parseStructuredLogInput", () => {
  it("parses number + unit in separate tokens", () => {
    const parsed = parseStructuredLogInput("300 ml water");
    expect(parsed.quantities).toEqual([{ value: 300, unit: "ml", source: "300 ml" }]);
    expect(parsed.hint).toBe("water");
    expect(parsed.hasExplicitUnit).toBe(true);
  });

  it("parses decimals", () => {
    const parsed = parseStructuredLogInput("95.3 kg");
    expect(parsed.quantities[0]?.unit).toBe("kg");
    expect(parsed.quantities[0]?.value).toBeCloseTo(95.3);
    expect(parsed.hint).toBe("");
  });

  it("parses multiple quantities with units", () => {
    const parsed = parseStructuredLogInput("indoor bike 240 kcal 25 min 7.4 km");
    expect(parsed.quantities).toEqual([
      { value: 240, unit: "kcal", source: "240 kcal" },
      { value: 25, unit: "min", source: "25 min" },
      { value: 7.4, unit: "km", source: "7.4 km" },
    ]);
    expect(parsed.hint).toBe("indoor bike");
  });

  it("keeps non-unit words as hint", () => {
    const parsed = parseStructuredLogInput("8000 steps");
    expect(parsed.quantities).toEqual([{ value: 8000, unit: null, source: "8000" }]);
    expect(parsed.hint).toBe("steps");
    expect(parsed.hasExplicitUnit).toBe(false);
  });

  it("parses compact tokens like 780kcal and 1h", () => {
    const parsed = parseStructuredLogInput("football 1h Poljud 2 goals 780kcal");
    expect(parsed.quantities).toEqual([
      { value: 1, unit: "h", source: "1h" },
      { value: 2, unit: null, source: "2" },
      { value: 780, unit: "kcal", source: "780kcal" },
    ]);
    expect(parsed.hint.toLowerCase()).toBe("football poljud goals");
  });
});

