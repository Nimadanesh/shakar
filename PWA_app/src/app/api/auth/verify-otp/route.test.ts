/**
 * verify-otp route test for finding #6 (bug-bounty round 2).
 *
 * Exercises the REAL route handler. Only the backend boundary is faked:
 * - getOtpBackend is mocked to a prod-shaped config + an atomic fake
 *   store (incrementAttempts models the increment_otp_attempts RPC: one
 *   indivisible read-modify-write, like the quota.test.ts fakeDb).
 * - latestActive deliberately returns a STALE snapshot (attempts: 0) for
 *   every concurrent request — the precise TOCTOU window: all racers read
 *   before any increment lands.
 *
 * The OLD route code (check attempts >= max BEFORE incrementing) saw
 * 0 < 5 for all six and returned six 400s — the brute-force budget was
 * silently exceeded. The new code increments first and denies when the
 * post-increment count EXCEEDS max: exactly one 429.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/otp/server", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/otp/server")>();
  return { ...orig, getOtpBackend: vi.fn() };
});

import { getOtpBackend } from "@/lib/otp/server";
import { hashCode } from "@/lib/otp/store";
import { POST } from "@/app/api/auth/verify-otp/route";

const mockBackend = vi.mocked(getOtpBackend);

const MOBILE = "09123456789";
const REAL_CODE = "00000";
const WRONG_CODE = "11111";

/** Atomic fake store: increments are indivisible; reads are stale. */
function atomicStore() {
  let attempts = 0;
  const maxAttempts = 5;
  interface FakeRecord {
    id: string;
    mobile: string;
    codeHash: string;
    expiresAt: number;
    attempts: number;
    maxAttempts: number;
    consumedAt: null;
    createdAt: number;
  }
  return {
    latestActive: vi.fn(async (): Promise<FakeRecord | null> => ({
      id: "rec-1",
      mobile: MOBILE,
      codeHash: await hashCode(REAL_CODE),
      expiresAt: Date.now() + 300_000,
      // STALE: every concurrent request reads the pre-race count.
      attempts: 0,
      maxAttempts,
      consumedAt: null,
      createdAt: Date.now(),
    })),
    incrementAttempts: vi.fn(async () => {
      attempts += 1; // the RPC's single UPDATE — cannot interleave
      return { attempts, maxAttempts };
    }),
    consume: vi.fn(async () => {}),
    create: vi.fn(),
    remove: vi.fn(),
    sentSince: vi.fn(async () => 0),
    claimSend: vi.fn(),
  };
}

function backendWith(store: ReturnType<typeof atomicStore>, sb: unknown = {}) {
  mockBackend.mockReturnValue({
    config: {
      isProd: true,
      providerName: "kavenegar",
      kavenegarApiKey: "k",
      kavenegarTemplate: "t",
      sessionSecret: "test-secret",
      supabaseUrl: "u",
      supabaseServiceKey: "k",
      ready: true,
      missing: [],
    },
    provider: {},
    store,
    sb,
  } as never);
}

function post(code: string) {
  return POST(
    new Request("http://x/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: MOBILE, code }),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("finding #6 — concurrent wrong-code verifies", () => {
  it("the 6th concurrent attempt gets 429, the first five get 400", async () => {
    const store = atomicStore();
    backendWith(store);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => post(WRONG_CODE))
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 400)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);

    const bodies = await Promise.all(results.map((r) => r.json()));
    const limited = bodies.filter((b) => b.error?.code === "RATE_LIMITED");
    expect(limited).toHaveLength(1);
    expect(limited[0].error.message).toBe("تلاش زیاد؛ کد جدید بگیر.");
    // All six attempts were counted — nothing lost.
    expect(store.incrementAttempts).toHaveBeenCalledTimes(6);
  });

  it("a correct code on a fresh record still verifies (no over-blocking)", async () => {
    const store = atomicStore();
    // ensureProfileId hits sb.rest — fake the profiles lookup.
    backendWith(store, { rest: vi.fn(async () => [{ id: "user-1" }]) });

    const res = await post(REAL_CODE);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.userId).toBe("user-1");
    expect(store.consume).toHaveBeenCalledWith("rec-1", expect.any(Number));
  });

  it("an expired/missing record is still 400, not 429", async () => {
    const store = atomicStore();
    store.latestActive.mockResolvedValue(null);
    backendWith(store);

    const res = await post(WRONG_CODE);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("EXPIRED_CODE");
    expect(store.incrementAttempts).not.toHaveBeenCalled();
  });
});
