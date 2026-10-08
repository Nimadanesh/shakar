"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearActiveHunt,
  readActiveHunt,
  type ActiveHunt,
} from "@/lib/active-hunt";

/**
 * Verified active hunt (shared). Reads the session-scoped record and
 * confirms against the server — a finished hunt never reports as running.
 * Used by ActiveHuntChip so every page agrees on which hunt is live.
 *
 * Reactive by design (navid 2026-10-08): AppChrome never remounts on
 * navigation, so a mount-once check missed every hunt fired after the
 * first page load — the badge never appeared in the normal flow. Now
 * the hook wakes the instant a hunt is fired (shekaar:active-hunt-set),
 * re-reads the record every few seconds as a backstop, and clears the
 * moment the hunt completes — via the run page's event on the same tab
 * or the featherweight status poll on any other page.
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
      // One-shot per run id: a later check re-verifies (cheap — the run
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
  const activeRef = useRef<ActiveHunt | null>(null);

  useEffect(() => {
    let cancelled = false;

    function setTracked(next: ActiveHunt | null) {
      activeRef.current = next;
      if (!cancelled) setActive(next);
    }

    /** Re-read the record; verify only when it's a hunt we aren't showing. */
    async function refresh() {
      if (cancelled) return;
      const found = readActiveHunt();
      const prev = activeRef.current;
      if (!found) {
        if (prev !== null) setTracked(null);
        return;
      }
      if (prev && prev.runId === found.runId) return; // already showing it
      setTracked(await verifyActiveHunt(found));
    }

    /** While a hunt is shown, notice the moment it completes. */
    async function repoll() {
      if (cancelled) return;
      const cur = activeRef.current;
      if (!cur) return;
      const stillRunning = await pollStatus(cur.runId);
      if (!stillRunning && !cancelled) {
        clearActiveHunt(cur.runId);
        setTracked(null);
      }
    }

    function onSet() {
      void refresh();
    }
    function onCleared(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (activeRef.current && activeRef.current.runId === id) setTracked(null);
    }

    window.addEventListener("shekaar:active-hunt-set", onSet);
    window.addEventListener("shekaar:active-hunt-cleared", onCleared);
    const timer = window.setInterval(() => {
      void refresh();
      void repoll();
    }, 5000);
    void refresh();

    return () => {
      cancelled = true;
      window.removeEventListener("shekaar:active-hunt-set", onSet);
      window.removeEventListener("shekaar:active-hunt-cleared", onCleared);
      window.clearInterval(timer);
    };
  }, []);

  return active;
}
