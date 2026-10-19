import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.resetModules();
});

describe("onboarding completion", () => {
  it("remembers completion when storage is unavailable, preventing a return loop", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    const progress = await import("./progress");
    expect(progress.isOnboardingComplete()).toBe(false);
    progress.completeOnboarding();
    expect(progress.isOnboardingComplete()).toBe(true);
  });
  it("respects and persists the existing completion marker", async () => {
    const progress = await import("./progress");
    expect(progress.isOnboardingComplete()).toBe(false);
    progress.completeOnboarding();
    expect(localStorage.getItem("memoato:onboardingDone")).toBe("1");
    vi.resetModules();
    expect((await import("./progress")).isOnboardingComplete()).toBe(true);
  });
});
