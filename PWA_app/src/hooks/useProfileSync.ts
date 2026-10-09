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
 * 2026-10-09 completion:
 * - PUSH ON LOGIN: local favorites/hidden/saved created before login are
 *   pushed to the server once per user (idempotent — the server dedupes).
 *   Without this, pre-login local data was stranded on the device.
 * - TOMBSTONES: deletes made while offline are recorded locally and pushed
 *   on the next sync; merges skip tombstoned ids so they can't zombie back.
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

/* ------------------------------------------------------------------ */
/* Tombstones: ids deleted while offline. Merges skip them (no zombie */
/* re-adds); the next successful sync pushes them as DELETEs, then     */
/* clears them. Capped so the list can't grow forever.                 */
/* ------------------------------------------------------------------ */

const TOMBSTONE_CAP = 500;

function tombstoneKey(kind: "favorites" | "hidden-ads"): string {
  return `shakar:${kind}:tombstones:v1`;
}

function readTombstones(kind: "favorites" | "hidden-ads"): Set<string> {
  try {
    const raw = window.localStorage.getItem(tombstoneKey(kind));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function addTombstone(kind: "favorites" | "hidden-ads", id: string): void {
  try {
    const set = readTombstones(kind);
    set.add(id);
    const arr = [...set].slice(-TOMBSTONE_CAP);
    window.localStorage.setItem(tombstoneKey(kind), JSON.stringify(arr));
  } catch {
    // Best-effort.
  }
}

function removeTombstone(kind: "favorites" | "hidden-ads", id: string): void {
  try {
    const set = readTombstones(kind);
    if (!set.delete(id)) return;
    window.localStorage.setItem(tombstoneKey(kind), JSON.stringify([...set]));
  } catch {
    // Best-effort.
  }
}

export function mergeFavorites(server: ServerFavorite[]): void {
  if (typeof window === "undefined" || server.length === 0) return;
  try {
    const key = "shakar:favorites:v1";
    const raw = window.localStorage.getItem(key);
    const local: Array<{ adId: string; sourceAdId: string }> = raw ? JSON.parse(raw) : [];
    const seen = new Set(local.map((r) => r.adId));
    const tombstones = readTombstones("favorites");
    const merged = [...local];
    for (const s of server) {
      // Tombstoned = deleted on this device (possibly offline) — never
      // re-add; the tombstone is pushed as a DELETE on the next sync.
      if (seen.has(s.ad_token) || tombstones.has(s.ad_token)) continue;
      merged.push({ adId: s.ad_token, sourceAdId: s.ad_token });
      seen.add(s.ad_token);
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
    const tombstones = readTombstones("hidden-ads");
    const merged = [...local];
    for (const s of server) {
      if (seen.has(s.ad_token) || tombstones.has(s.ad_token)) continue;
      merged.push(s.ad_token);
      seen.add(s.ad_token);
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

const PUSHED_KEY = "shakar:sync:pushed:v1";

function wasPushed(userId: string): boolean {
  try {
    const raw = window.localStorage.getItem(PUSHED_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { userId?: unknown }).userId === userId
    );
  } catch {
    return false;
  }
}

function markPushed(userId: string): void {
  try {
    window.localStorage.setItem(PUSHED_KEY, JSON.stringify({ userId, ts: Date.now() }));
  } catch {
    // Best-effort.
  }
}

/**
 * Push pre-login local data to the server, once per user. The pull+merge
 * already ran, so anything local WITHOUT a server counterpart is
 * genuinely new. All three POSTs are idempotent server-side
 * (ignore-duplicates / upsert), so a retry can't create dupes.
 */
async function pushLocalToServer(userId: string): Promise<boolean> {
  if (wasPushed(userId)) return true;
  try {
    // Favorites: local ids not seen on the server.
    const favRaw = window.localStorage.getItem("shakar:favorites:v1");
    const favs: Array<{ adId: string }> = favRaw ? JSON.parse(favRaw) : [];
    const serverFavs = new Set(
      (await fetchJson<ServerFavorite[]>("/api/me/favorites"))?.map((f) => f.ad_token) ?? []
    );
    for (const f of favs) {
      if (!f.adId || serverFavs.has(f.adId)) continue;
      await fetch("/api/me/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adToken: f.adId, title: "", city: null }),
      }).catch(() => {});
    }

    // Hidden ads: same shape.
    const hidRaw = window.localStorage.getItem("shakar:hidden-ads:v1");
    const hids: string[] = hidRaw ? JSON.parse(hidRaw) : [];
    const serverHids = new Set(
      (await fetchJson<ServerHiddenAd[]>("/api/me/hidden-ads"))?.map((h) => h.ad_token) ?? []
    );
    for (const id of hids) {
      if (!id || serverHids.has(id)) continue;
      await fetch("/api/me/hidden-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adToken: id }),
      }).catch(() => {});
    }

    // Saved hunts: local rows without a serverId, deduped by query.
    const shRaw = window.localStorage.getItem("shakar:saved-hunts:v1");
    const saved: Array<{ query?: string; serverId?: string; base?: unknown }> = shRaw
      ? JSON.parse(shRaw)
      : [];
    const serverSaved = new Set(
      (await fetchJson<ServerSavedHunt[]>("/api/me/saved-hunts"))?.map((s) => s.id) ?? []
    );
    void serverSaved;
    const seenQueries = new Set<string>();
    for (const s of saved) {
      const q = typeof s.query === "string" ? s.query.trim() : "";
      if (q === "" || s.serverId || seenQueries.has(q)) continue;
      seenQueries.add(q);
      await fetch("/api/me/saved-hunts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q, definition: { query: q, base: s.base ?? null } }),
      }).catch(() => {});
    }

    markPushed(userId);
    return true;
  } catch {
    return false;
  }
}

/** Push tombstoned deletes to the server, then clear them. */
async function pushTombstones(): Promise<void> {
  const jobs: Array<{ kind: "favorites" | "hidden-ads"; url: string }> = [
    { kind: "favorites", url: "/api/me/favorites" },
    { kind: "hidden-ads", url: "/api/me/hidden-ads" },
  ];
  for (const { kind, url } of jobs) {
    const ids = [...readTombstones(kind)];
    for (const id of ids) {
      try {
        const res = await fetch(`${url}?adToken=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (res.ok) removeTombstone(kind, id);
      } catch {
        // Keep the tombstone; retry next sync.
      }
    }
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
    // Push pre-login local data up (once per user), then flush tombstones.
    // Order matters: push first so a tombstoned id deleted pre-login isn't
    // resurrected by the push racing the merge.
    if (ok) {
      await pushLocalToServer(session.userId);
      await pushTombstones();
    }
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
    // Re-favoriting clears any tombstone for this id.
    removeTombstone("favorites", adId);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adToken: adId, title: title ?? "", city: null }),
    }).catch(() => {
      // Best-effort; the local write already succeeded.
    });
  } else {
    // Record the delete even if the network fails — the tombstone is
    // pushed on the next sync and blocks zombie re-adds meanwhile.
    addTombstone("favorites", adId);
    fetch(`${url}?adToken=${encodeURIComponent(adId)}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) removeTombstone("favorites", adId);
      })
      .catch(() => {});
  }
}

/** Write-through: when logged in, mirror a hide/unhide to the server. */
export function syncHiddenAdToggle(adId: string, isNowHidden: boolean): void {
  if (!getSession()) return;
  const url = "/api/me/hidden-ads";
  if (isNowHidden) {
    removeTombstone("hidden-ads", adId);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adToken: adId }),
    }).catch(() => {
      // Best-effort; the local write already succeeded.
    });
  } else {
    addTombstone("hidden-ads", adId);
    fetch(`${url}?adToken=${encodeURIComponent(adId)}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) removeTombstone("hidden-ads", adId);
      })
      .catch(() => {});
  }
}
