"use client";

import { useEffect, useState } from "react";
import {
  clearActiveHunt,
  readActiveHunt,
  type ActiveHunt,
} from "@/lib/active-hunt";

/**
 * Verified active hunt (shared). Reads the session-scoped record and
 * confirms against the server once — a finished hunt never reports as
 * running. Used by ActiveHuntChip and RecentHunts so both agree on
 * which hunt is live.
 *
 * The verification fetch is shared module-wide: both consumers ask about
 * the same run, so one request serves both instead of two identical GETs
 * (each of which could return the full results array for a done run).
 */
const verifiedByRun = new Map<string, Promise<ActiveHunt | null>>();

function verifyActiveHunt(found: ActiveHunt): Promise<ActiveHunt | null> {
  const existing = verifiedByRun.get(found.runId);
  if (existing) return existing;
  const p = fetch(`/api/hunts/${encodeURIComponent(found.runId)}`)
    .then(async (res) => {
      if (!res.ok) {
        clearActiveHunt(found.runId);
        return null;
      }
      const json: unknown = await res.json().catch(() => null);
      const status = (json as { data?: { status?: string } })?.data?.status;
      if (status === "done" || status === "failed") {
        clearActiveHunt(found.runId);
        return null;
      }
      return found;
    })
    .catch(() => {
      // Offline: keep it; the run page will sort it out.
      return found;
    })
    .finally(() => {
      // One-shot per run id: a later mount re-verifies (cheap — the run
      // is either live or the record was cleared).
      if (verifiedByRun.get(found.runId) === p) verifiedByRun.delete(found.runId);
    });
  verifiedByRun.set(found.runId, p);
  return p;
}

export function useActiveHunt(): ActiveHunt | null {
  const [active, setActive] = useState<ActiveHunt | null>(null);

  useEffect(() => {
    const found = readActiveHunt();
    if (!found) return;
    let cancelled = false;
    verifyActiveHunt(found).then((result) => {
      if (!cancelled) setActive(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return active;
}
