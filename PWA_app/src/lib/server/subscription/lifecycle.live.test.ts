/**
 * LIVE M6 verification (navid 2026-10-08) — runs against the REAL Supabase
 * with the transient shakar_test_01 key from env. NOT a paper test.
 *
 * Uses a throwaway fake user_id; every row it creates is deleted at the
 * end. Run:
 *   SUPABASE_URL=https://tvrvzptholylzcnnfijm.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
 *   npx vitest run src/lib/server/subscription/lifecycle.live.test.ts
 *
 * The key is env-only, never stored. Skipped unless BOTH env vars exist.
 */
import { describe, expect, it, afterAll } from "vitest";

const URL = process.env.SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LIVE = URL !== "" && KEY !== "";

describe.skipIf(!LIVE)("M6 lifecycle LIVE (real Supabase)", () => {
  it(
    "intent -> activate -> expire -> renew, with cleanup",
    async () => {
    const { supabaseServer } = await import("@/lib/supabase-server");
    const {
      createIntent,
      activateSubscription,
      expireCheck,
      renewSubscription,
      getSubscription,
    } = await import("@/lib/server/subscription/lifecycle");

    const sb = supabaseServer();
    expect(sb).not.toBeNull();
    // Throwaway UUID — clearly not a real user; deleted in finally.
    // subscriptions.user_id has an FK to profiles, so the test profile
    // is created first and removed last.
    const TEST_USER = "00000000-0000-0000-0000-000000000042";

    try {
      await sb!.rest("POST", "profiles", {
        id: TEST_USER,
        mobile: "+980000000042",
        display_name: "LIVE-TEST (delete me)",
      });

      // 1. Intent: pending, priced from tier_prices.
      const { subscription: intent, created } = await createIntent(
        sb!,
        TEST_USER,
        "paye",
        "monthly"
      );
      expect(created).toBe(true);
      expect(intent.status).toBe("pending");
      expect(intent.tier).toBe("paye");
      expect(Number(intent.price_toman)).toBe(200000);

      // 2. Activate: pending -> active, cycle starts, quota reset.
      const active = await activateSubscription(sb!, TEST_USER, intent.id);
      expect(active.status).toBe("active");
      expect(active.cycle_started_at).not.toBeNull();
      expect(active.cycle_ends_at).not.toBeNull();
      const qc = await sb!.rest<Array<{ hunts_used: number }>>(
        "GET",
        `quota_counters?user_id=eq.${TEST_USER}&select=hunts_used`
      );
      expect(qc.length).toBe(1);
      expect(Number(qc[0].hunts_used)).toBe(0);

      // 3. Force expiry: backdate the cycle end, then expireCheck.
      const past = new Date(Date.now() - 1000).toISOString();
      await sb!.rest("PATCH", `subscriptions?id=eq.${intent.id}`, {
        cycle_ends_at: past,
      });
      const expired = await expireCheck(sb!, TEST_USER);
      expect(expired?.status).toBe("expired");

      // 4. Renew: expired -> active with a fresh cycle.
      const { subscription: renewed, renewed: didRenew } =
        await renewSubscription(sb!, TEST_USER, intent.id, "live-test-key-1");
      expect(didRenew).toBe(true);
      expect(renewed.status).toBe("active");
      expect(
        new Date(renewed.cycle_ends_at as string).getTime()
      ).toBeGreaterThan(Date.now());

      // 5. Idempotent renew: same key does not extend twice.
      const again = await renewSubscription(
        sb!,
        TEST_USER,
        intent.id,
        "live-test-key-1"
      );
      expect(again.renewed).toBe(false);
      expect(again.subscription.cycle_ends_at).toBe(renewed.cycle_ends_at);
    } finally {
      // Cleanup: never leave test rows behind (profile last — FK).
      const sub = await getSubscription(sb!, TEST_USER).catch(() => null);
      if (sub) {
        await sb!
          .rest("DELETE", `subscriptions?id=eq.${sub.id}`)
          .catch(() => null);
      }
      await sb!
        .rest("DELETE", `quota_counters?user_id=eq.${TEST_USER}`)
        .catch(() => null);
      await sb!
        .rest("DELETE", `profiles?id=eq.${TEST_USER}`)
        .catch(() => null);
    }
  },
  90000);

  afterAll(async () => {
    // Belt and suspenders: confirm no test rows remain.
    const { supabaseServer } = await import("@/lib/supabase-server");
    const sb = supabaseServer();
    if (!sb) return;
    const rows = await sb
      .rest<Array<{ id: string }>>(
        "GET",
        "subscriptions?user_id=eq.00000000-0000-0000-0000-000000000042&select=id"
      )
      .catch(() => []);
    expect(rows.length).toBe(0);
    const profs = await sb
      .rest<Array<{ id: string }>>(
        "GET",
        "profiles?id=eq.00000000-0000-0000-0000-000000000042&select=id"
      )
      .catch(() => []);
    expect(profs.length).toBe(0);
  });
});
