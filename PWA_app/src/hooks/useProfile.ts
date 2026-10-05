"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "shakar:profile:v1";
const EVENT_NAME = "shakar:profile";

export interface Profile {
  name: string;
}

function readStored(): Profile {
  if (typeof window === "undefined") return { name: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && typeof (parsed as { name?: unknown }).name === "string") {
      return { name: (parsed as { name: string }).name };
    }
  } catch {
    // Corrupt storage → treat as guest.
  }
  return { name: "" };
}

/** First letters of the first two words: «نوید دانش» → «ند». */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("");
}

/**
 * Local profile (name only for now). Server identity + auth arrive with
 * the backend; until then this is honest local state, never presented
 * as an account. Same-tab updates propagate via a window event.
 */
export function useProfile() {
  // Hydration-safe: the server can't see localStorage, so the first render
  // (server and client) is the guest state; the stored name lands after
  // mount. Reading storage in the initializer would hydrate-mismatch every
  // consumer that renders the name or initials.
  const [profile, setProfile] = useState<Profile>({ name: "" });

  useEffect(() => {
    const refresh = () => setProfile(readStored());
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const saveName = useCallback((name: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name.trim() }));
    } catch {
      // Storage unavailable — the UI still reflects the edit attempt honestly.
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  return { name: profile.name, saveName };
}
