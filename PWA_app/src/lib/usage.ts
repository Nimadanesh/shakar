"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/device";

export interface UsageData {
  kind: "user" | "guest";
  usedThisMonth: number;
  /** Tier monthly limit / guest grant. */
  quotaTotal: number | null;
  remaining: number | null;
  /** Hunt counts per day, oldest → newest, 14 entries. */
  daily: number[];
  /** Max ACTIVE kamins for the tier (hard slot limit). Null when N/A. */
  kaminSlots: number | null;
  /** Currently active kamins. Null when N/A. */
  kaminActive: number | null;
}

/**
 * Server usage numbers for the profile. Returns:
 *  - undefined while loading (caller shows its local numbers meanwhile),
 *  - null when the server can't provide them (caller falls back to local),
 *  - UsageData when available (same on every device).
 *
 * The fetch is shared module-wide: HuntSetup, PlanSheet (mounted even when
 * closed), and Header all need the same numbers, so one request serves
 * every instance instead of N identical concurrent GETs. Cached for 30s;
 * call invalidateUsage() after an action that changes quota (firing a hunt).
 */
let sharedFetch: Promise<UsageData | null> | null = null;
let sharedAt = 0;
const SHARED_TTL_MS = 30_000;

export function invalidateUsage(): void {
  sharedFetch = null;
  sharedAt = 0;
}

function fetchUsageOnce(): Promise<UsageData | null> {
  const now = Date.now();
  if (sharedFetch && now - sharedAt < SHARED_TTL_MS) return sharedFetch;
  sharedAt = now;
  sharedFetch = (async () => {
    try {
      const res = await fetch("/api/me/usage", {
        headers: { "X-Device-Id": getDeviceId() },
      });
      const json: unknown = await res.json().catch(() => null);
      const data =
        typeof json === "object" && json !== null && (json as { ok?: unknown }).ok === true
          ? ((json as { data?: unknown }).data as UsageData | null)
          : null;
      return isUsageData(data) ? data : null;
    } catch {
      return null;
    }
  })();
  // A rejection must never poison the cache for the rest of the session.
  sharedFetch.catch(() => {
    sharedFetch = null;
    sharedAt = 0;
  });
  return sharedFetch;
}

export function useServerUsage(): UsageData | null | undefined {
  const [usage, setUsage] = useState<UsageData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchUsageOnce().then((data) => {
      if (!cancelled) setUsage(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return usage;
}

function isUsageData(v: unknown): v is UsageData {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === "user" || o.kind === "guest") &&
    typeof o.usedThisMonth === "number" &&
    Array.isArray(o.daily) &&
    o.daily.length === 14 &&
    o.daily.every((n) => typeof n === "number")
  );
}
