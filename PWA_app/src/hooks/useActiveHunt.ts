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
 */
export function useActiveHunt(): ActiveHunt | null {
  const [active, setActive] = useState<ActiveHunt | null>(null);

  useEffect(() => {
    const found = readActiveHunt();
    if (!found) return;
    let cancelled = false;
    fetch(`/api/hunts/${encodeURIComponent(found.runId)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          clearActiveHunt(found.runId);
          return;
        }
        return res.json().then((json: unknown) => {
          if (cancelled) return;
          const status = (json as { data?: { status?: string } })?.data?.status;
          if (status === "done" || status === "failed") {
            clearActiveHunt(found.runId);
          } else {
            setActive(found);
          }
        });
      })
      .catch(() => {
        // Offline: keep it; the run page will sort it out.
        if (!cancelled) setActive(found);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return active;
}
