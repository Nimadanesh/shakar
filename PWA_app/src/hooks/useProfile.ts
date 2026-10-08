"use client";

import { useCallback, useEffect, useState } from "react";
import { getCached, setCached } from "@/lib/session-cache";
import { getSession } from "@/lib/auth";

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

function writeStored(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name }));
  } catch {
    // Storage unavailable — the UI still reflects the edit attempt honestly.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

async function fetchServerName(): Promise<string> {
  try {
    const res = await fetch("/api/me/profile");
    const json: unknown = await res.json().catch(() => null);
    if (typeof json === "object" && json !== null && (json as { ok?: unknown }).ok === true) {
      const data = (json as { data?: unknown }).data as { name?: unknown } | null;
      return typeof data?.name === "string" ? data.name : "";
    }
  } catch {
    // Server unreachable → caller falls back to the device-local name.
  }
  return "";
}

// Shared module-wide: Header's avatar and the profile page mount separate
// useProfile instances — one server read serves both, not two.
let serverNameFetch: Promise<string> | null = null;
function fetchServerNameShared(): Promise<string> {
  if (!serverNameFetch) {
    serverNameFetch = fetchServerName().then(
      (name) => {
        serverNameFetch = null; // one-shot: later mounts re-read
        return name;
      },
      () => {
        serverNameFetch = null;
        return "";
      }
    );
  }
  return serverNameFetch;
}

async function pushServerName(name: string): Promise<void> {
  try {
    await fetch("/api/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    // Local copy is already saved; the next saveName retries the server.
  }
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
 * Display name. Logged-in users: the server owns it (identical on every
 * device; a pre-login device name is adopted once). Guests: device-local —
 * there is no account to attach it to, and the UI says so honestly.
 * Same-tab updates propagate via a window event.
 */
export function useProfile() {
  // Hydration-safe: the server can't see localStorage, so the first render
  // (server and client) is the guest state; the stored name lands after
  // mount. Reading storage in the initializer would hydrate-mismatch every
  // consumer that renders the name or initials.
  // Session-cache seed: revisits within a session render the known name
  // immediately instead of flickering guest → name on every navigation.
  const [profile, setProfile] = useState<Profile>(
    () => getCached<Profile>("profile") ?? { name: "" }
  );
  const [serverBacked, setServerBacked] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isLoggedIn = getSession() !== null;
    setLoggedIn(isLoggedIn);
    const apply = (name: string, backed: boolean) => {
      if (cancelled) return;
      const next = { name };
      setCached("profile", next);
      setProfile(next);
      setServerBacked(backed);
    };
    let timer = 0;
    if (isLoggedIn) {
      (async () => {
        const serverName = await fetchServerNameShared();
        if (cancelled) return;
        if (serverName !== "") {
          apply(serverName, true);
          return;
        }
        // First login with a pre-existing device name → adopt it once.
        const local = readStored();
        if (local.name !== "") await pushServerName(local.name);
        apply(readStored().name, true);
      })();
    } else {
      // Guest: defer a tick — no setState runs synchronously in the
      // effect body (cascading-render lint). The session-cache seed
      // already painted the known name, so nothing flickers.
      timer = window.setTimeout(() => apply(readStored().name, false), 0);
    }
    const onExternal = () => {
      const next = readStored();
      setCached("profile", next);
      if (!cancelled) setProfile(next);
    };
    window.addEventListener(EVENT_NAME, onExternal);
    window.addEventListener("storage", onExternal);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(EVENT_NAME, onExternal);
      window.removeEventListener("storage", onExternal);
    };
  }, []);

  const saveName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    // Write-through cache: local first (instant UI), server when logged in.
    writeStored(trimmed);
    if (getSession() !== null) await pushServerName(trimmed);
  }, []);

  return { name: profile.name, saveName, serverBacked, loggedIn };
}
