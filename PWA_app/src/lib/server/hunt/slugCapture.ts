/**
 * Step 0.5 (Smart Engine Plan v5): breadcrumb capture.
 *
 * Every verified ad detail carries Divar's leaf category slug. The
 * confirmation loop reads it for kind corroboration and used to drop it;
 * this module persists (ad ID, slug, capture date) pairs to the
 * `ad_slug_captures` corpus table (migration m27) so Step 1's knowledge
 * layer can mine is-a relations from the product's own traffic.
 *
 * Invariants (plan §5 Step 0.5, bought with this codebase's scar tissue —
 * the 2026-10-07 P0 was silent fallback breakage):
 * - FAIL-OPEN: a capture failure never fails, delays (beyond a bounded
 *   2 s finalize flush), or alters a hunt. Failures are COUNTED in the
 *   run stats, so corpus completeness is itself measurable.
 * - Only FRESH details contribute (stale detail = unverified data, the
 *   existing pipeline invariant); the caller enforces this by only
 *   recording pairs from the fresh-detail branch.
 * - Dedup key is (ad_id, capture_date): same-day re-captures collapse via
 *   the table PK + ignore-duplicates; a later date is a NEW independent
 *   capture — exactly what the knowledge layer's support rule counts.
 * - When Supabase is unconfigured (lab / in-memory backend mode), pairs
 *   buffer to a local append-only JSONL file for later backfill; the gap
 *   window is visible in the counts (buffered > 0).
 */

import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabaseServer, type SupabaseServer } from "@/lib/supabase-server";

export interface SlugCaptureStats {
  attempted: number;
  written: number;
  failed: number;
  buffered: number;
}

export interface SlugCaptureDeps {
  /** Injectable for tests; default = the real server client (or null). */
  sb?: SupabaseServer | null;
  /** Injectable for tests; default = env SLUG_CAPTURE_BUFFER_PATH or tmpdir. */
  bufferPath?: string;
  /** Injectable for tests; default = 2000 ms (the plan's bounded wait). */
  timeoutMs?: number;
  now?: Date;
}

function bufferFilePath(explicit?: string): string {
  return (
    explicit ??
    process.env.SLUG_CAPTURE_BUFFER_PATH ??
    join(tmpdir(), "shekar-slug-captures.jsonl")
  );
}

/**
 * Flush one hunt's slug pairs. NEVER throws. Returns the counts the
 * caller merges into the run stats.
 */
export async function flushSlugCaptures(
  pairs: Map<string, string>,
  deps: SlugCaptureDeps = {}
): Promise<SlugCaptureStats> {
  const stats: SlugCaptureStats = {
    attempted: pairs.size,
    written: 0,
    failed: 0,
    buffered: 0,
  };
  if (pairs.size === 0) return stats;

  const now = deps.now ?? new Date();
  const captureDate = now.toISOString().slice(0, 10);
  const rows = [...pairs.entries()].map(([adId, slug]) => ({
    ad_id: adId,
    category_slug: slug,
    capture_date: captureDate,
  }));

  const sb = deps.sb !== undefined ? deps.sb : supabaseServer();
  if (sb) {
    const timeoutMs = deps.timeoutMs ?? 2000;
    try {
      await Promise.race([
        sb.rest<unknown>(
          "POST",
          "ad_slug_captures",
          rows,
          "resolution=ignore-duplicates,return=minimal"
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("slug capture timeout")), timeoutMs)
        ),
      ]);
      stats.written = rows.length;
    } catch {
      stats.failed = rows.length;
    }
    return stats;
  }

  // Unconfigured (lab / memory backend): buffer locally for backfill.
  try {
    const lines =
      rows
        .map((r) => JSON.stringify({ ...r, captured_at: now.toISOString() }))
        .join("\n") + "\n";
    await appendFile(bufferFilePath(deps.bufferPath), lines, "utf8");
    stats.buffered = rows.length;
  } catch {
    stats.failed = rows.length;
  }
  return stats;
}
