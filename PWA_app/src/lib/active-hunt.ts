/**
 * Active-hunt registry (session-scoped). When a hunt is fired, its run is
 * recorded here; navigating away doesn't lose it — the ActiveHuntChip lets
 * the user return to the live run (the server run continues and the
 * stream re-attaches). The record is cleared when the run's page reaches
 * a terminal state.
 */
const ACTIVE_KEY = "shakar:active-hunt:v1";

export interface ActiveHunt {
  runId: string;
  query: string;
  ts: number;
}

/** Record a hunt as active (called when a run id comes back from /api/hunts). */
export function setActiveHunt(runId: string, query: string): void {
  try {
    window.sessionStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({ runId, query, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

/** Clear the active hunt (called when its page reaches a terminal state). */
export function clearActiveHunt(runId?: string): void {
  try {
    if (runId) {
      const raw = window.sessionStorage.getItem(ACTIVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveHunt;
        if (parsed.runId !== runId) return;
      }
    }
    window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export function readActiveHunt(): ActiveHunt | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveHunt;
    if (typeof parsed.runId !== "string" || typeof parsed.query !== "string") return null;
    // Stale guard: a hunt never runs longer than 10 minutes.
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
      window.sessionStorage.removeItem(ACTIVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
