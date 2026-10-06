import "server-only";

import type { HuntDefinition } from "./pipeline";

/**
 * In-memory hunt runs (M4a). POST /api/hunts creates the run and returns
 * the id immediately; GET /api/hunts/[id]/stream runs the pipeline.
 * Runs expire after 30 min. M4b persists runs to the Supabase hunts table.
 */
export interface HuntRun {
  id: string;
  def: HuntDefinition;
  createdAt: number;
  userId: string | null;
}

const runs = new Map<string, HuntRun>();
const RUN_TTL_MS = 30 * 60 * 1000;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRun(def: HuntDefinition, userId: string | null): HuntRun {
  // Opportunistic cleanup of expired runs.
  const now = Date.now();
  for (const [id, r] of runs) {
    if (now - r.createdAt > RUN_TTL_MS) runs.delete(id);
  }
  const run: HuntRun = { id: makeId(), def, createdAt: now, userId };
  runs.set(run.id, run);
  return run;
}

export function getRun(id: string): HuntRun | undefined {
  const run = runs.get(id);
  if (!run) return undefined;
  if (Date.now() - run.createdAt > RUN_TTL_MS) {
    runs.delete(id);
    return undefined;
  }
  return run;
}
