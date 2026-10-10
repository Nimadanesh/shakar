"use client";

import type { ContextBase } from "@/lib/search-context";
import { getDeviceId } from "@/lib/device";
import { setActiveHunt } from "@/lib/active-hunt";

export interface FireHuntInput {
  query: string;
  base: ContextBase;
  dismissed: ReadonlySet<string> | string[];
}

/**
 * Multi-location fire planning (pure, tested). Contract:
 * - An explicit multi-city set always wins, touched or not (it can only
 *   come from a deliberate pick or a restored link — never a default).
 * - Untouched picker + live query-city inference → the inferred city wins
 *   (the text is the freshest signal; the dashed row already showed it).
 * - Hand-picked single/all (cityTouched) → the pick wins; live
 *   query-city inferences are dismissed so the server cannot re-apply an
 *   overridden guess. A query typed after the pick gets fresh ids, so
 *   only the pick-time inference is silenced, never future ones.
 * - No inference → the set stands as-is (possibly all-locations).
 */
export function planFireLocations(args: {
  baseCities: string[];
  cityTouched: boolean;
  inferredCity: { id: string; value: string } | null;
  liveCityIds: string[];
  dismissed: ReadonlySet<string>;
}): { cities: string[]; dismissed: Set<string> } {
  if (args.baseCities.length > 1) {
    const next = new Set(args.dismissed);
    for (const id of args.liveCityIds) next.add(id);
    return { cities: [...args.baseCities], dismissed: next };
  }
  if (!args.cityTouched && args.inferredCity) {
    return { cities: [args.inferredCity.value], dismissed: new Set(args.dismissed) };
  }
  const next = new Set(args.dismissed);
  if (args.cityTouched) {
    for (const id of args.liveCityIds) next.add(id);
  }
  return { cities: [...args.baseCities], dismissed: next };
}

export type FireHuntResult =
  | { ok: true; runId: string }
  | { ok: false; quotaError: string | null };

/**
 * Fire ONE real server hunt (M4+). The single place that POSTs
 * /api/hunts — the home form, kamin re-runs and anywhere else a paid
 * hunt starts. Returns the server run id; the caller records it
 * (hunt-store, with runId) and navigates to /hunt/[runId].
 *
 * Quota-exhausted / suspended responses surface as quotaError with the
 * API's honest Persian copy — never any per-hunt pricing language.
 */
export async function fireRealHunt(input: FireHuntInput): Promise<FireHuntResult> {
  const trimmed = input.query.trim();
  if (trimmed === "") return { ok: false, quotaError: null };
  const res = await fetch("/api/hunts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": getDeviceId(),
    },
    body: JSON.stringify({
      query: trimmed,
      include: input.base.include,
      exclude: input.base.exclude,
      city: input.base.city,
      cities: input.base.cities ?? [],
      category: input.base.category,
      priceMin: input.base.priceMin,
      priceMax: input.base.priceMax,
      transaction: input.base.transaction,
      condition: input.base.condition,
      // Inferred readings the user dismissed — the server must not
      // re-apply them (deterministic constraint ids).
      dismissed: Array.from(input.dismissed),
      idempotencyKey:
        typeof window !== "undefined" && window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: { runId?: string };
    message?: string;
  } | null;
  if (res.status === 402 || res.status === 403) {
    return {
      ok: false,
      quotaError:
        typeof json?.message === "string" && json.message !== ""
          ? json.message
          : "سهمیه‌ات تموم شده.",
    };
  }
  const runId = json?.ok === true ? json.data?.runId : undefined;
  if (typeof runId === "string" && runId !== "") {
    // Mark active so navigating away doesn't lose the hunt — the chip
    // lets the user return to the live run (re-attach).
    setActiveHunt(runId, trimmed);
    return { ok: true, runId };
  }
  return { ok: false, quotaError: null };
}
