// The user's standing city preference — chosen explicitly in the city sheet,
// remembered on-device so the laziest user taps zero times after the first
// pick. Divar does the same; a GPS permission prompt does not.
//
// Deliberately conservative: only EXPLICIT sheet selections are remembered.
// A city inferred from query text never overwrites the preference — a
// one-off «پیانو شیراز» must not flip the default of someone living in Tehran.

import { CITIES } from "@/data/taxonomy";

const STORAGE_KEY = "shekaar-city";

const VALID_IDS = new Set<string>(CITIES.map((c) => c.value));

/** The remembered city id, or null when the user has no standing preference. */
export function getRememberedCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw !== null && VALID_IDS.has(raw) && raw !== "all" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Persist an explicit city choice. Selecting «همه شهرها» (or an unknown id)
 * clears the preference — the neutral default is no city, never a guess.
 */
export function rememberCity(cityId: string): void {
  if (typeof window === "undefined") return;
  try {
    if (cityId === "all" || !VALID_IDS.has(cityId)) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, cityId);
    }
  } catch {
    // Private mode etc. — the preference just won't persist. Not fatal.
  }
}
