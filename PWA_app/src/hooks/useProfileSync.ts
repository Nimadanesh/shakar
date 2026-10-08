"use client";

import { useEffect, useRef } from "react";
import { getSession } from "@/lib/auth";

/**
 * Profile sync (navid 2026-10-08): the profile IS the phone number.
 * When logged in, the server is the source of truth — this hook pulls
 * favorites, saved hunts, and hunt history from the server on mount and
 * merges them into the device-local stores (union; server wins on conflict).
 * Writes go through the existing local functions AND the server APIs
 * (see the individual stores).
 *
 * Guest mode: everything stays device-local, exactly as before.
 */

interface ServerFavorite {
  ad_token: string;
  title: string;
  city: string | null;
  created_at: string;
}

interface ServerSavedHunt {
  id: string;
  name: string;
  definition: unknown;
  created_at: string;
}

interface ServerHistoryItem {
  runId: string;
  query: string;
  status: string;
  ts: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: T };
    return json.ok === true ? (json.data as T) : null;
  } catch {
    return null;
  }
}

function mergeFavorites(server: ServerFavorite[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:favorites:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ adId: string; sourceAdId: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.adId));
    const merged = [...local];
    for (const s of server) {
      if (!seen.has(s.ad_token)) {
        merged.push({
          adId: s.ad_token,
          sourceAdId: s.ad_token,
        });
        seen.add(s.ad_token);
      }
    }
    window.localStorage.setItem(
      key,
      JSON.stringify(
        merged.map((r) => ({
          adId: r.adId,
          source: "divar",
          sourceAdId: r.sourceAdId,
          savedAt: Date.now(),
        }))
      )
    );
    window.dispatchEvent(new Event("shakar:favorites-cache"));
  } catch {
    // Sync is best-effort; local data remains.
  }
}

function mergeSavedHunts(server: ServerSavedHunt[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:saved-hunts:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ id: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.id));
    const merged = [...local];
    for (const s of server) {
      const id = `server:${s.id}`;
      if (!seen.has(id)) {
        merged.push({
          id,
          ...(s.definition as Record<string, unknown>),
          name: s.name,
        } as { id: string });
        seen.add(id);
      }
    }
    window.localStorage.setItem(key, JSON.stringify(merged));
  } catch {
    // Sync is best-effort.
  }
}

function mergeHistory(server: ServerHistoryItem[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:hunts:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ id: string; runId?: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.runId ?? r.id));
    const merged = [...local];
    for (const s of server) {
      if (!seen.has(s.runId)) {
        merged.push({
          id: `server:${s.runId}`,
          runId: s.runId,
          query: s.query,
          ts: s.ts,
          status: s.status,
        } as { id: string });
        seen.add(s.runId);
      }
    }
    // Keep newest first, cap at 200.
    merged.sort((a, b) => ((b as { ts?: number }).ts ?? 0) - ((a as { ts?: number }).ts ?? 0));
    window.localStorage.setItem(key, JSON.stringify(merged.slice(0, 200)));
  } catch {
    // Sync is best-effort.
  }
}

/**
 * Runs once per mount when the user is logged in. Pulls server state and
 * merges into local stores. Safe to call from multiple components (guarded).
 */
let syncRun = false;

export function useProfileSync(): void {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || syncRun) return;
    ran.current = true;
    const session = getSession();
    if (!session) return; // Guest — nothing to sync.
    syncRun = true;
    (async () => {
      const [favorites, savedHunts, history] = await Promise.all([
        fetchJson<ServerFavorite[]>("/api/me/favorites"),
        fetchJson<ServerSavedHunt[]>("/api/me/saved-hunts"),
        fetchJson<ServerHistoryItem[]>("/api/me/history"),
      ]);
      if (favorites) mergeFavorites(favorites);
      if (savedHunts) mergeSavedHunts(savedHunts);
      if (history) mergeHistory(history);
    })();
  }, []);
}

/** Write-through: when logged in, mirror a favorite toggle to the server. */
export function syncFavoriteToggle(adId: string, isNowFavorite: boolean, title?: string): void {
  if (!getSession()) return;
  const url = "/api/me/favorites";
  if (isNowFavorite) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adToken: adId, title: title ?? "", city: null }),
    }).catch(() => {
      // Best-effort; the local write already succeeded.
    });
  } else {
    fetch(`${url}?adToken=${encodeURIComponent(adId)}`, { method: "DELETE" }).catch(() => {});
  }
}
