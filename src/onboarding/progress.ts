// Keep this session usable even when the browser blocks storage.
let completedThisSession = false;

export function completeOnboarding() {
  completedThisSession = true;
  try {
    localStorage.setItem("memoato:onboardingDone", "1");
  } catch {
    /* Session fallback above. */
  }
}

export function isOnboardingComplete() {
  if (completedThisSession) return true;
  try {
    return localStorage.getItem("memoato:onboardingDone") === "1";
  } catch {
    return false;
  }
}
