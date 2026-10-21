/**
 * Guard tests for POST /api/internal/kamins/tick — the CRON_SECRET check.
 * The tick route is heavy (kamin engine, web push), so those are mocked;
 * the tests exercise only the secret guard at the top of the handler.
 *
 * Regression: /api/internal/quota/grant got the trim fix first (secrets
 * pasted into the Railway variable editor smuggle trailing whitespace),
 * while tick compared raw — the same secret would 403 here. All
 * CRON_SECRET-guarded routes must trim identically.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));
vi.mock("@/lib/server/kamin/engine", () => ({
  tickDueKamins: vi.fn(async () => ({ checked: 0 })),
  realEnginePipeline: vi.fn(() => ({ collect: vi.fn(), confirm: vi.fn() })),
}));
vi.mock("@/lib/server/push", () => ({
  sendPushToUser: vi.fn(),
}));

import { supabaseConfigured } from "@/lib/supabase-server";
import { POST } from "@/app/api/internal/kamins/tick/route";

function post(secret: string | null) {
  const headers = new Headers();
  if (secret !== null) headers.set("x-cron-secret", secret);
  return POST(
    new Request("http://x/api/internal/kamins/tick", { method: "POST", headers })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  // Guard is what we test; stop right after it (supabase unconfigured → 503).
  vi.mocked(supabaseConfigured).mockReturnValue(false);
});

describe("POST /api/internal/kamins/tick — secret guard", () => {
  it("403 without the secret, 503 without CRON_SECRET configured", async () => {
    expect((await post("wrong")).status).toBe(403);
    expect((await post(null)).status).toBe(403);
    delete process.env.CRON_SECRET;
    const r = await post("s3cr3t");
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe("not-configured");
  });

  it("accepts a secret with pasted trailing whitespace (trim parity with grant)", async () => {
    process.env.CRON_SECRET = "s3cr3t\n";
    const res = await post("s3cr3t");
    // The pre-fix failure mode was a permanent 403 "forbidden" here.
    expect(res.status).not.toBe(403);
    expect((await res.json()).error).not.toBe("forbidden");
  });

  it("trims the incoming header too", async () => {
    const res = await post("s3cr3t ");
    expect(res.status).not.toBe(403);
  });

  it("treats a whitespace-only CRON_SECRET as not configured (fail-closed)", async () => {
    process.env.CRON_SECRET = "   ";
    const res = await post("s3cr3t");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("not-configured");
  });
});
