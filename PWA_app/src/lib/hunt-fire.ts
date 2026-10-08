"use client";

import type { ContextBase } from "@/lib/search-context";
import { getDeviceId } from "@/lib/device";
import { setActiveHunt } from "@/lib/active-hunt";

export interface FireHuntInput {
  query: string;
  base: ContextBase;
  dismissed: ReadonlySet<string> | string[];
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
