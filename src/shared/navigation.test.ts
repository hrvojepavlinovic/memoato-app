import { describe, expect, it } from "vitest";
import { appNavigation, isNavigationActive } from "./navigation";

describe("shared app navigation", () => {
  it("keeps all five workflows present, including Context", () => {
    expect(appNavigation.map((item) => item.to)).toEqual([
      "/",
      "/memory",
      "/recall",
      "/views",
      "/context",
    ]);
  });
  it("identifies nested routes without matching unrelated prefixes", () => {
    for (const [path, destination] of [
      ["/", "/"],
      ["/onboarding", "/"],
      ["/timeline/2026-10-19", "/memory"],
      ["/memory", "/memory"],
      ["/recall", "/recall"],
      ["/c/running", "/views"],
      ["/categories/new", "/views"],
      ["/context", "/context"],
    ]) {
      expect(
        appNavigation
          .filter((item) => isNavigationActive(path, item.paths))
          .map((item) => item.to),
      ).toEqual([destination]);
    }
    expect(
      appNavigation.some((item) =>
        isNavigationActive("/contextual", item.paths),
      ),
    ).toBe(false);
    expect(
      appNavigation.some((item) => isNavigationActive("/profile", item.paths)),
    ).toBe(false);
  });
});
