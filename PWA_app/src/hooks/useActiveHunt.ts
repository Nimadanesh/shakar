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
 * Staying honest while visible (navid 2026-10-08): the old version
 * verified ONCE on mount and then never again, so a chip that appeared
 * after a refresh stayed forever — even after the hunt completed.
 * Now it (1) hides instantly on the same-tab completion event the run
 * page dispatches, and (2) re-checks the featherweight status endpoint
 * every 15s while visible, so completion on another page/tab also
 * clears it.
 */
const verifiedByRun = new Map<string, Promise<ActiveHunt | null>>();

function verifyActiveHunt(found: ActiveHunt): Promise<ActiveHunt | null> {
  const existing = verifiedByRun.get(found.runId);
  if (existing) return existing;
  const p = fetch(`/api/hunts/${encodeURIComponent(found.runId)}/status`)
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

async function pollStatus(runId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/hunts/${encodeURIComponent(runId)}/status`);
    if (!res.ok) return false;
    const json: unknown = await res.json().catch(() => null);
    const status = (json as { data?: { status?: string } })?.data?.status;
    return status !== "done" && status !== "failed";
  } catch {
    return true; // offline — keep showing; the run page sorts it out
  }
}

export function useActiveHunt(): ActiveHunt | null {
  const [active, setActive] = useState<ActiveHunt | null>(null);

  useEffect(() => {
    const found: ActiveHunt | null = readActiveHunt();
    if (!found) return;
    const run = found; // narrowed once — closures below see a non-null const
    let cancelled = false;
    verifyActiveHunt(run).then((result) => {
      if (!cancelled) setActive(result);
    });
    // Same-tab completion: the run page dispatches this on done/error.
    function onCleared(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id === run.runId && !cancelled) setActive(null);
    }
    window.addEventListener("shekaar:active-hunt-cleared", onCleared);
    // Cross-page/tab completion: re-check while visible.
    const timer = window.setInterval(async () => {
      if (cancelled) return;
      const stillRunning = await pollStatus(run.runId);
      if (!stillRunning && !cancelled) {
        clearActiveHunt(run.runId);
        setActive(null);
      }
    }, 15_000);
    return () => {
      cancelled = true;
      window.removeEventListener("shekaar:active-hunt-cleared", onCleared);
      window.clearInterval(timer);
    };
  }, []);

  return active;
}
