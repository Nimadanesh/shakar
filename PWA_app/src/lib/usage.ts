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
 */
export function useServerUsage(): UsageData | null | undefined {
  const [usage, setUsage] = useState<UsageData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/usage", {
          headers: { "X-Device-Id": getDeviceId() },
        });
        const json: unknown = await res.json().catch(() => null);
        const data =
          typeof json === "object" && json !== null && (json as { ok?: unknown }).ok === true
            ? ((json as { data?: unknown }).data as UsageData | null)
            : null;
        if (!cancelled) setUsage(isUsageData(data) ? data : null);
      } catch {
        if (!cancelled) setUsage(null);
      }
    })();
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
