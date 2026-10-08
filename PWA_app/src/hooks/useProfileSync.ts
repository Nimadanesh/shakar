"use client";

import { useEffect, useState } from "react";
import { getSession, onSessionChange } from "@/lib/auth";
import { getDeviceId } from "@/lib/device";
import { invalidateCached } from "@/lib/session-cache";
import { normalizeBase } from "@/lib/saved-hunts";

/**
 * Profile sync (navid 2026-10-08): the profile IS the phone number.
 * When logged in, the server is the source of truth — this hook pulls
 * favorites, saved hunts, hidden ads, and hunt history from the server and
 * merges them into the device-local stores (union; server wins on conflict).
 * Writes go through the individual stores, which mirror to the server
 * best-effort when logged in (see saved-hunts.ts, useFavorites,
 * useHiddenAds). After every merge the session cache is invalidated so
 * mounted hooks re-read immediately.
 *
 * Retry: a failed sync is retried with backoff (not skipped for the
 * session), and the sync re-runs whenever the session appears or changes
 * (guest → login included).
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
  definition: { query?: unknown; base?: unknown } | null;
  created_at: string;
}

interface ServerHiddenAd {
  ad_token: string;
  created_at: string;
}

interface ServerHistoryItem {
  runId: string;
  query: string;
  status: string;
  ts: number;
  definition: { query?: unknown; base?: unknown } | null;
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

export function mergeFavorites(server: ServerFavorite[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:favorites:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ adId: string; sourceAdId: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.adId));
    const merged = [...local];
    for (const s of server) {
      if (!seen.has(s.ad_token)) {
        merged.push({ adId: s.ad_token, sourceAdId: s.ad_token });
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
    // Mounted hooks listen to shakar:cache-invalidate (not the old dead
    // shakar:favorites-cache event) — re-read immediately.
    invalidateCached("favorites");
  } catch {
    // Sync is best-effort; local data remains.
  }
}

export function mergeSavedHunts(server: ServerSavedHunt[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:saved-hunts:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ id: string; query?: string; serverId?: string }> = raw
      ? JSON.parse(raw)
      : [];
    const byServerId = new Set(
      local.map((r) => r.serverId).filter((v): v is string => typeof v === "string")
    );
    const queries = new Set(
      local.map((r) => r.query).filter((v): v is string => typeof v === "string")
    );
    const merged: Array<Record<string, unknown>> = [...local];
    for (const s of server) {
      if (byServerId.has(s.id)) continue;
      const def = s.definition ?? {};
      const rawQuery = typeof def.query === "string" ? def.query.trim() : "";
      const query = rawQuery !== "" ? rawQuery : s.name.trim();
      if (query === "") continue;
      if (queries.has(query)) {
        // Same hunt saved on this device before the mirror existed —
        // adopt the server id so future deletes write through.
        const li = merged.findIndex((r) => r.query === query && !r.serverId);
        if (li >= 0) merged[li] = { ...merged[li], serverId: s.id };
        continue;
      }
      merged.push({
        id: `server:${s.id}`,
        query,
        base: normalizeBase(def.base ?? def),
        ts: new Date(s.created_at).getTime() || Date.now(),
        serverId: s.id,
      });
      queries.add(query);
      byServerId.add(s.id);
    }
    window.localStorage.setItem(key, JSON.stringify(merged.slice(0, 20)));
    invalidateCached("saved-hunts");
  } catch {
    // Sync is best-effort.
  }
}

export function mergeHiddenAds(server: ServerHiddenAd[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:hidden-ads:v1";
    const raw = window.localStorage.getItem(key);
    const local: string[] = raw ? JSON.parse(raw) : [];
    const seen = new Set(local);
    const merged = [...local];
    for (const s of server) {
      if (!seen.has(s.ad_token)) {
        merged.push(s.ad_token);
        seen.add(s.ad_token);
      }
    }
    window.localStorage.setItem(key, JSON.stringify(merged));
    invalidateCached("hidden-ads");
  } catch {
    // Sync is best-effort.
  }
}

export function mergeHistory(server: ServerHistoryItem[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:hunts:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ id: string; runId?: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.runId ?? r.id));
    const merged: Array<Record<string, unknown>> = [...local];
    for (const s of server) {
      if (seen.has(s.runId) || s.query.trim() === "") continue;
      const def = s.definition ?? {};
      merged.push({
        id: `server:${s.runId}`,
        runId: s.runId,
        query: s.query,
        // Without a base the record fails normalize() and readHunts()
        // silently drops it — the definition carries the real base.
        base: normalizeBase(def.base ?? def),
        ts: s.ts,
        status: s.status,
      });
      seen.add(s.runId);
    }
    // Keep newest first, cap at 200.
    merged.sort((a, b) => ((b.ts as number) ?? 0) - ((a.ts as number) ?? 0));
    window.localStorage.setItem(key, JSON.stringify(merged.slice(0, 200)));
    invalidateCached("hunts");
  } catch {
    // Sync is best-effort.
  }
}

/** Claim this device's orphaned guest runs after login (best-effort). */
async function claimGuestRuns(): Promise<void> {
  try {
    await fetch("/api/me/history/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
  } catch {
    // Best-effort; unclaimed runs stay visible device-locally.
  }
}

let syncInFlight = false;
let lastSyncOkAt = 0;
let syncFailures = 0;
let claimedFor: string | null = null;

async function runSync(): Promise<void> {
  if (syncInFlight || typeof window === "undefined") return;
  const session = getSession();
  if (!session) return; // Guest — nothing to sync.
  syncInFlight = true;
  try {
    // Claim first: orphaned guest runs must be owned before the pull,
    // otherwise this device's own pre-login hunts are missing from it.
    if (claimedFor !== session.userId) {
      await claimGuestRuns();
      claimedFor = session.userId;
    }
    const [favorites, savedHunts, hiddenAds, history] = await Promise.all([
      fetchJson<ServerFavorite[]>("/api/me/favorites"),
      fetchJson<ServerSavedHunt[]>("/api/me/saved-hunts"),
      fetchJson<ServerHiddenAd[]>("/api/me/hidden-ads"),
      fetchJson<ServerHistoryItem[]>("/api/me/history"),
    ]);
    const ok = favorites !== null && savedHunts !== null && hiddenAds !== null && history !== null;
    if (favorites) mergeFavorites(favorites);
    if (savedHunts) mergeSavedHunts(savedHunts);
    if (hiddenAds) mergeHiddenAds(hiddenAds);
    if (history) mergeHistory(history);
    if (ok) {
      lastSyncOkAt = Date.now();
      syncFailures = 0;
    } else {
      syncFailures += 1;
    }
  } finally {
    syncInFlight = false;
  }
}

/**
 * Runs on mount when logged in, re-runs when the session appears or
 * changes, and retries failed syncs with backoff (capped at 5 minutes).
 * Safe to call from multiple components (in-flight guarded).
 */
export function useProfileSync(): void {
  const [sessionTick, setSessionTick] = useState(0);

  useEffect(() => onSessionChange(() => setSessionTick((t) => t + 1)), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getSession()) return;
    const backoffMs = Math.min(5 * 60_000, 5_000 * 2 ** syncFailures);
    if (lastSyncOkAt === 0 || Date.now() - lastSyncOkAt > backoffMs) {
      void runSync();
    }
  }, [sessionTick]);
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

/** Write-through: when logged in, mirror a hide/unhide to the server. */
export function syncHiddenAdToggle(adId: string, isNowHidden: boolean): void {
  if (!getSession()) return;
  const url = "/api/me/hidden-ads";
  if (isNowHidden) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adToken: adId }),
    }).catch(() => {
      // Best-effort; the local write already succeeded.
    });
  } else {
    fetch(`${url}?adToken=${encodeURIComponent(adId)}`, { method: "DELETE" }).catch(() => {});
  }
}
