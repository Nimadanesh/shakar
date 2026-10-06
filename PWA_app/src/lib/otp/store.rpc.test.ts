/**
 * Atomic OTP RPC contracts (findings #6, #10 — bug-bounty round 2).
 *
 * The fake `rest` below models each RPC as its SQL really behaves: ONE
 * statement, no await between the read and the write — so Promise.all
 * cannot interleave inside it. That single-statement property is exactly
 * what the m8 migration guarantees in Postgres; the fake only stands in
 * for the DB boundary, never for the code under test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseOtpStore } from "@/lib/otp/store";
import { ipSendAllowed } from "@/lib/otp/server";

interface VRow {
  id: string;
  mobile: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
  created_at: number; // epoch ms
}

function sharedDb() {
  const verifications = new Map<string, VRow>();
  const ipHits: Array<{ ip: string; hit_at: number }> = [];
  let seq = 0;

  const notFound = () => {
    throw Object.assign(new Error("not found"), { status: 404 });
  };

  /** One fake "instance". Call makeRest() twice sharing the tables to model two Railway instances. */
  const makeRest = (opts: { rpc?: boolean } = {}) =>
    vi.fn(async (method: string, path: string, body?: unknown) => {
      const b = (body ?? {}) as Record<string, unknown>;
      if (path.startsWith("/rpc/")) {
        if (!opts.rpc) notFound();
        // --- increment_otp_attempts: single UPDATE, no await inside ---
        if (path === "/rpc/increment_otp_attempts") {
          const row = verifications.get(String(b.p_id));
          if (!row) return [];
          row.attempts += 1;
          return [{ attempts: row.attempts, max_attempts: row.max_attempts }];
        }
        // --- check_otp_ip_limit: cleanup + insert + count, one statement ---
        if (path === "/rpc/check_otp_ip_limit") {
          const now = Date.now();
          for (let i = ipHits.length - 1; i >= 0; i--) {
            if (ipHits[i].hit_at < now - 2 * 3600_000) ipHits.splice(i, 1);
          }
          ipHits.push({ ip: String(b.p_ip), hit_at: now });
          const n = ipHits.filter(
            (h) => h.ip === String(b.p_ip) && h.hit_at > now - Number(b.p_window_secs) * 1000
          ).length;
          return [{ allowed: n <= Number(b.p_limit) }];
        }
        // --- claim_otp_send: count + conditional insert, one statement ---
        if (path === "/rpc/claim_otp_send") {
          const now = Date.now();
          let n = 0;
          for (const r of verifications.values()) {
            if (r.mobile === String(b.p_mobile) && r.created_at > now - Number(b.p_window_secs) * 1000) n++;
          }
          if (n >= Number(b.p_limit)) return [];
          const id = `v-${++seq}`;
          verifications.set(id, {
            id,
            mobile: String(b.p_mobile),
            code_hash: String(b.p_code_hash),
            expires_at: String(b.p_expires_at),
            attempts: 0,
            max_attempts: Number(b.p_max_attempts),
            consumed_at: null,
            created_at: now,
          });
          return [{ id }];
        }
        notFound();
      }
      // --- legacy table paths (fallback) ---
      if (method === "GET" && path.startsWith("/otp_verifications")) {
        const m = path.match(/id=eq\.([^&]+)/);
        const row = m ? verifications.get(decodeURIComponent(m[1])) : undefined;
        return row ? [row] : [];
      }
      if (method === "PATCH" && path.startsWith("/otp_verifications")) {
        const m = path.match(/id=eq\.([^&]+)/);
        const row = m ? verifications.get(decodeURIComponent(m[1])) : undefined;
        if (!row) return [];
        Object.assign(row, { attempts: Number((body as Record<string, unknown>).attempts) });
        return [row];
      }
      throw new Error(`unexpected ${method} ${path}`);
    });

  const seedVerification = (over: Partial<VRow> = {}): VRow => {
    const id = `v-${++seq}`;
    const row: VRow = {
      id,
      mobile: "09123456789",
      code_hash: "h",
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      attempts: 0,
      max_attempts: 5,
      consumed_at: null,
      created_at: Date.now(),
      ...over,
    };
    verifications.set(id, row);
    return row;
  };

  return { makeRest, verifications, ipHits, seedVerification };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("increment_otp_attempts (finding #6)", () => {
  it("N concurrent increments advance attempts by exactly N", async () => {
    const db = sharedDb();
    const row = db.seedVerification({ attempts: 0 });
    const store = new SupabaseOtpStore(db.makeRest({ rpc: true }) as never);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.incrementAttempts(row.id))
    );

    // Every increment observed a distinct count — no lost updates.
    const counts = results.map((r) => r!.attempts).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(db.verifications.get(row.id)!.attempts).toBe(10);
    expect(results[0]!.maxAttempts).toBe(5);
  });

  it("returns null for an unknown id", async () => {
    const db = sharedDb();
    const store = new SupabaseOtpStore(db.makeRest({ rpc: true }) as never);
    expect(await store.incrementAttempts("nope")).toBeNull();
  });

  it("falls back to legacy GET+PATCH with a loud warning when the RPC is missing", async () => {
    const db = sharedDb();
    const row = db.seedVerification({ attempts: 2 });
    const store = new SupabaseOtpStore(db.makeRest({ rpc: false }) as never);

    const res = await store.incrementAttempts(row.id);
    expect(res).toEqual({ attempts: 3, maxAttempts: 5 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("m8-otp-atomic.sql"));
  });
});

describe("claim_otp_send (finding #10b)", () => {
  const claim = (mobile = "09123456789") => ({
    mobile,
    codeHash: "h",
    expiresAt: Date.now() + 300_000,
    maxAttempts: 5,
    limit: 5,
    windowSecs: 3600,
  });

  it("concurrent sends at the limit create exactly `limit` rows", async () => {
    const db = sharedDb();
    // 4 sends already in the window; limit is 5.
    for (let i = 0; i < 4; i++) db.seedVerification();
    const store = new SupabaseOtpStore(db.makeRest({ rpc: true }) as never);

    const results = await Promise.all([
      store.claimSend(claim()),
      store.claimSend(claim()),
      store.claimSend(claim()),
    ]);

    const granted = results.filter(Boolean);
    expect(granted).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(2);
    expect(db.verifications.size).toBe(5);
  });

  it("sends outside the window don't count", async () => {
    const db = sharedDb();
    for (let i = 0; i < 5; i++) {
      db.seedVerification({ created_at: Date.now() - 2 * 3600_000 });
    }
    const store = new SupabaseOtpStore(db.makeRest({ rpc: true }) as never);
    expect(await store.claimSend(claim())).not.toBeNull();
  });

  it("falls back to legacy sentSince+create with a loud warning", async () => {
    const db = sharedDb();
    // No RPCs: every /rpc/* 404s, so claimSend uses sentSince + create.
    const rest = vi.fn(async (method: string, path: string, body?: Record<string, unknown>) => {
      if (path.startsWith("/rpc/")) {
        throw Object.assign(new Error("not found"), { status: 404 });
      }
      if (method === "GET" && path.startsWith("/otp_verifications")) {
        return [];
      }
      if (method === "POST" && path === "/otp_verifications") {
        const row = db.seedVerification({
          mobile: String(body?.mobile),
          code_hash: String(body?.code_hash),
        });
        return [row];
      }
      throw new Error(`unexpected ${method} ${path}`);
    });
    const store = new SupabaseOtpStore(rest as never);

    const res = await store.claimSend(claim());
    expect(res).not.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("m8-otp-atomic.sql"));
  });
});

describe("check_otp_ip_limit (finding #10a)", () => {
  it("two instances share one budget — 21st hit denied across both", async () => {
    const db = sharedDb();
    // Two "Railway instances": separate rest fns, ONE shared table.
    const sbA = { rest: db.makeRest({ rpc: true }) };
    const sbB = { rest: db.makeRest({ rpc: true }) };

    const results: boolean[] = [];
    for (let i = 0; i < 12; i++) results.push(await ipSendAllowed(sbA as never, "1.2.3.4"));
    for (let i = 0; i < 8; i++) results.push(await ipSendAllowed(sbB as never, "1.2.3.4"));
    expect(results.every(Boolean)).toBe(true);

    // 21st hit — denied no matter which instance serves it.
    expect(await ipSendAllowed(sbA as never, "1.2.3.4")).toBe(false);
    expect(await ipSendAllowed(sbB as never, "1.2.3.4")).toBe(false);
    // A different IP is unaffected.
    expect(await ipSendAllowed(sbA as never, "9.9.9.9")).toBe(true);
  });

  it("falls back to the in-memory check with a loud warning when the RPC is missing", async () => {
    const db = sharedDb();
    const sb = { rest: db.makeRest({ rpc: false }) };
    const ip = "3.3.3.3-unique";
    for (let i = 0; i < 20; i++) {
      expect(await ipSendAllowed(sb as never, ip)).toBe(true);
    }
    expect(await ipSendAllowed(sb as never, ip)).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("m8-otp-atomic.sql"));
  });

  it("sb null → in-memory check (dev)", async () => {
    const ip = "4.4.4.4-unique";
    for (let i = 0; i < 20; i++) expect(await ipSendAllowed(null, ip)).toBe(true);
    expect(await ipSendAllowed(null, ip)).toBe(false);
  });
});
