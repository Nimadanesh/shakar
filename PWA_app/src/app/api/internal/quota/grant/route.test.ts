/**
 * Route tests for POST /api/internal/quota/grant — the support top-up tool.
 * Mocks supabase-server with a tiny in-memory fake; exercises the REAL
 * handler: secret guard, UUID validation, and the pool-keying semantics
 * (subscriber → hunts_used give-back; guest pools → granted extension).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { POST } from "@/app/api/internal/quota/grant/route";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);

const UID = "11111111-1111-4111-8111-111111111111";
const DID = "22222222-2222-4222-8222-222222222222";

function fakeDb(seed: Record<string, Array<Record<string, unknown>>> = {}) {
  const tables: Record<string, Array<Record<string, unknown>>> = JSON.parse(
    JSON.stringify(seed)
  );
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    const [table] = path.split("?");
    if (method === "GET") {
      const m = path.match(/(\w+)=eq\.([^&]+)/);
      if (!m) return tables[table] ?? [];
      const [, col, val] = m;
      return (tables[table] ?? []).filter((r) => String(r[col]) === decodeURIComponent(val));
    }
    if (method === "POST") {
      (tables[table] ??= []).push(body as Record<string, unknown>);
      return body;
    }
    if (method === "PATCH") {
      const m = path.match(/(\w+)=eq\.([^&]+)/);
      const [, col, val] = m!;
      for (const r of tables[table] ?? []) {
        if (String(r[col]) === decodeURIComponent(val)) Object.assign(r, body);
      }
      return [];
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
  return { tables, rest };
}

function post(body: unknown, secret: string | null = "s3cr3t") {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secret !== null) headers.set("x-cron-secret", secret);
  return POST(new Request("http://x/api/internal/quota/grant", { method: "POST", headers, body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  mockConfigured.mockReturnValue(true);
});

describe("POST /api/internal/quota/grant", () => {
  it("403 without the secret, 503 without CRON_SECRET configured", async () => {
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const r1 = await post({ userId: UID, hunts: 5 }, "wrong");
    expect(r1.status).toBe(403);
    delete process.env.CRON_SECRET;
    const r2 = await post({ userId: UID, hunts: 5 });
    expect(r2.status).toBe(503);
  });

  it("400 on non-UUID keys and bad hunts (typos fail fast)", async () => {
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    expect((await post({ userId: "not-a-uuid", hunts: 5 })).status).toBe(400);
    expect((await post({ userId: UID, hunts: 0 })).status).toBe(400);
    expect((await post({ userId: UID, deviceId: DID, hunts: 5 })).status).toBe(400);
    expect((await post({ hunts: 5 })).status).toBe(400);
  });

  it("subscriber: gives back consumed units, never below zero", async () => {
    const db = fakeDb({ quota_counters: [{ user_id: UID, hunts_used: 3 }], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const res = await post({ userId: UID, hunts: 5 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, data: { pool: "subscription", huntsUsed: 0 } });
    expect(db.tables.quota_counters[0].hunts_used).toBe(0);
  });

  it("registered-unsubscribed: extends the userId-keyed guest pool", async () => {
    const db = fakeDb({
      quota_counters: [],
      devices: [{ id: UID, fingerprint_hash: UID, free_hunts_used: 3, free_hunts_granted: 3 }],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const res = await post({ userId: UID, hunts: 10 });
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, data: { pool: "guest", freeHuntsGranted: 13 } });
    // used is untouched — a grant never destroys anything.
    expect(db.tables.devices[0].free_hunts_used).toBe(3);
  });

  it("deviceId: extends the device-keyed pool, creating the row if missing", async () => {
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const res = await post({ deviceId: DID, hunts: 7 });
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, data: { pool: "guest", freeHuntsGranted: 7 } });
    expect(db.tables.devices).toHaveLength(1);
  });
});
