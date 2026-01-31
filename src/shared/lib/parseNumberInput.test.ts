import { describe, expect, it } from "vitest";
import { parseNumberInput } from "./parseNumberInput";

describe("parseNumberInput", () => {
  it("parses integers", () => {
    expect(parseNumberInput("10")).toBe(10);
    expect(parseNumberInput("  10  ")).toBe(10);
  });

  it("parses decimals with dot or comma", () => {
    expect(parseNumberInput("95.15")).toBeCloseTo(95.15);
    expect(parseNumberInput("95,15")).toBeCloseTo(95.15);
  });

  it("parses thousand separators", () => {
    expect(parseNumberInput("1,234.56")).toBeCloseTo(1234.56);
    expect(parseNumberInput("1.234,56")).toBeCloseTo(1234.56);
  });

  it("rejects invalid", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("abc")).toBeNull();
  });
});

