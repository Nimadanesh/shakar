export const ONBOARDED_KEY = "shakar-onboarded";

/** True when the user has completed (or skipped) onboarding. */
export function isOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    // Storage unavailable: never trap the user in onboarding.
    return true;
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // ignore — the user still proceeds
  }
}
