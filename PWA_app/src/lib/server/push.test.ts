import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: { sendNotification, setVapidDetails },
}));

import type { SupabaseServer } from "@/lib/supabase-server";

const PAYLOAD = { title: "۲ آگهی تازه", body: "x", url: "/saved?tab=fresh", tag: "kamin-k1" };

function fakeSb(subs: Array<{ endpoint: string; p256dh: string; auth: string }>) {
  const deleted: string[] = [];
  const rest = vi.fn(async (method: string, path: string) => {
    if (method === "GET") return subs;
    if (method === "DELETE") {
      deleted.push(path);
      return [];
    }
    throw new Error(`unsupported ${method}`);
  });
  const sb = { url: "x", rest } as unknown as SupabaseServer;
  return { sb, deleted };
}

/** Fresh module per test — push.ts caches VAPID readiness at module level. */
async function freshPush() {
  vi.resetModules();
  return import("./push");
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_SUBJECT = "mailto:test@shekaar.test";
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("sendPushToUser", () => {
  it("sends to every subscription and prunes dead ones (410)", async () => {
    const { sendPushToUser } = await freshPush();
    const { sb, deleted } = fakeSb([
      { endpoint: "https://push/a", p256dh: "p1", auth: "a1" },
      { endpoint: "https://push/b", p256dh: "p2", auth: "a2" },
    ]);
    sendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    const r = await sendPushToUser(sb, "u1", PAYLOAD);
    expect(r).toEqual({ sent: 1, pruned: 1 });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain(encodeURIComponent("https://push/b"));
    expect(setVapidDetails).toHaveBeenCalled();
  });

  it("skips silently when VAPID is not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { sendPushToUser } = await freshPush();
    const { sb } = fakeSb([{ endpoint: "https://push/a", p256dh: "p1", auth: "a1" }]);
    const r = await sendPushToUser(sb, "u1", PAYLOAD);
    expect(r).toEqual({ sent: 0, pruned: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("no Supabase → no send, no crash", async () => {
    const { sendPushToUser } = await freshPush();
    const r = await sendPushToUser(null, "u1", PAYLOAD);
    expect(r).toEqual({ sent: 0, pruned: 0 });
  });
});
