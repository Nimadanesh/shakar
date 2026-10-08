import { CITIES } from "@/data/taxonomy";

// The user's HOME city — where they live (navid 2026-10-08).
//
// Two-location model: the home city seeds every hunt's city row, but a
// per-hunt change NEVER rewrites it. The old "remembered city" let a
// one-off Tabriz house hunt silently re-target all future hunts —
// hunting in city X once must not corrupt the default.
//
// Device-local for now (the old remembered city was too). Server sync for
// logged-in users is a queued follow-up on the profile-sync slice.
const STORAGE_KEY = "shekaar-home-city";
// The old remembered-city key — migrated once, then ignored.
const LEGACY_KEY = "shekaar-city";

const VALID_IDS = new Set<string>(CITIES.map((c) => c.value));

function valid(id: string | null): string | null {
  return id !== null && VALID_IDS.has(id) && id !== "all" ? id : null;
}

/** The home city id, or null when the user never set one. */
export function getHomeCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const home = valid(window.localStorage.getItem(STORAGE_KEY));
    if (home !== null) return home;
    // One-time migration: the old remembered city was the best available
    // signal for "where this user hunts most" — adopt it as home.
    const legacy = valid(window.localStorage.getItem(LEGACY_KEY));
    if (legacy !== null) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the home city. Choosing «همه شهرها» (or an unknown id) clears it —
 * the neutral default is no home city, never a guess.
 */
export function setHomeCity(cityId: string): void {
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
