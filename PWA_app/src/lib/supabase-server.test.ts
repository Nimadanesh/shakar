import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * P0 regression test (2026-10-07): supabaseServer().rest() must build a
 * correct PostgREST URL whether the caller passes "table" or "/table".
 * Before the fix, "table" produced ".../rest/v1kamins" → empty 404,
 * silently breaking quota, kamins, notifications, devices, hunt_runs
 * and M6 tables in production (masked by graceful fallbacks).
 */

const seenUrls: string[] = [];

describe("supabaseServer URL construction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    seenUrls.length = 0;
  });

  async function loadWithFetch() {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seenUrls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => [],
          text: async () => "[]",
        };
      })
    );
    const mod = await import("./supabase-server");
    return mod.supabaseServer()!;
  }

  it("adds the missing slash: 'kamins?...' → '/rest/v1/kamins?...'", async () => {
    const sb = await loadWithFetch();
    await sb.rest("GET", "kamins?select=id&limit=1");
    expect(seenUrls[0]).toBe(
      "https://example.supabase.co/rest/v1/kamins?select=id&limit=1"
    );
  });

  it("keeps a present slash: '/kamins?...' stays single-slashed", async () => {
    const sb = await loadWithFetch();
    await sb.rest("GET", "/kamins?select=id&limit=1");
    expect(seenUrls[0]).toBe(
      "https://example.supabase.co/rest/v1/kamins?select=id&limit=1"
    );
  });

  it("handles '/rpc/...' paths unchanged", async () => {
    const sb = await loadWithFetch();
    await sb.rest("POST", "/rpc/claim_otp_send", { p_ip: "1.2.3.4" });
    expect(seenUrls[0]).toBe(
      "https://example.supabase.co/rest/v1/rpc/claim_otp_send"
    );
  });
});
