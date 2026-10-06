import "server-only";

import type { HuntDefinition } from "./pipeline";
import type { QuotaKind, QuotaMode } from "../quota";

/**
 * In-memory hunt runs (M4a). POST /api/hunts creates the run and returns
 * the id immediately; GET /api/hunts/[id]/stream runs the pipeline.
 * Runs expire after 30 min. M4b persists runs to the Supabase hunts table.
 */
export interface QuotaReceipt {
  kind: QuotaKind;
  mode: QuotaMode;
  userId: string | null;
  deviceId: string;
  /**
   * False for the deep-history second phase: it's the SAME hunt continued,
   * no extra unit consumed — and therefore no refund on zero results.
   */
  charged: boolean;
}

export interface HuntRun {
  id: string;
  def: HuntDefinition;
  createdAt: number;
  userId: string | null;
  quota: QuotaReceipt;
}

const runs = new Map<string, HuntRun>();
const RUN_TTL_MS = 30 * 60 * 1000;

// Idempotency keys (client-generated per «شکار کن» tap): 24h window.
// Double-tap / retry with the same key returns the ORIGINAL run id —
// one tap can never consume two quota units.
const idemKeys = new Map<string, { runId: string; at: number }>();
const IDEM_TTL_MS = 24 * 3600 * 1000;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function claimIdempotency(key: string): { fresh: true } | { fresh: false; runId: string } {
  const hit = idemKeys.get(key);
  if (hit && Date.now() - hit.at < IDEM_TTL_MS) return { fresh: false, runId: hit.runId };
  return { fresh: true };
}

export function createRun(
  def: HuntDefinition,
  userId: string | null,
  quota: QuotaReceipt,
  idempotencyKey?: string
): HuntRun {
  // Opportunistic cleanup of expired runs and keys.
  const now = Date.now();
  for (const [id, r] of runs) {
    if (now - r.createdAt > RUN_TTL_MS) runs.delete(id);
  }
  for (const [k, v] of idemKeys) {
    if (now - v.at > IDEM_TTL_MS) idemKeys.delete(k);
  }
  const run: HuntRun = { id: makeId(), def, createdAt: now, userId, quota };
  runs.set(run.id, run);
  if (idempotencyKey) idemKeys.set(idempotencyKey, { runId: run.id, at: now });
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
