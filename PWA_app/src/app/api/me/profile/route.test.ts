/**
 * GET/PUT /api/me/profile — logged-in display name.
 * Mocks auth + PostgREST; exercises the REAL handlers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { getSessionUserId } from "@/lib/server/auth";
import { GET, PUT } from "@/app/api/me/profile/route";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);
const mockSession = vi.mocked(getSessionUserId);

const UID = "11111111-1111-4111-8111-111111111111";

function fakeSb() {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const profiles: Array<{ id: string; display_name: string | null }> = [
    { id: UID, display_name: "نوید" },
  ];
  return {
    calls,
    rest: vi.fn(async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      if (method === "GET" && path.startsWith("profiles")) {
        const id = path.match(/id=eq\.([^&]+)/)?.[1];
        return profiles.filter((p) => p.id === decodeURIComponent(id ?? ""));
      }
      if (method === "PATCH" && path.startsWith("profiles")) {
        const id = path.match(/id=eq\.([^&]+)/)?.[1];
        const row = profiles.find((p) => p.id === decodeURIComponent(id ?? ""));
        if (row) row.display_name = (body as { display_name: string }).display_name;
        return [];
      }
      throw new Error(`unexpected ${method} ${path}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  mockSession.mockResolvedValue(null);
});

describe("GET", () => {
  it("returns the server name for a logged-in user", async () => {
    mockSession.mockResolvedValue(UID);
    mockServer.mockReturnValue(fakeSb() as never);
    const json = await (await GET()).json();
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ name: "نوید" });
  });

  it("returns data null for guests", async () => {
    mockServer.mockReturnValue(fakeSb() as never);
    const json = await (await GET()).json();
    expect(json.ok).toBe(true);
    expect(json.data).toBeNull();
  });
});

describe("PUT", () => {
  function put(body: unknown) {
    return PUT(
      new Request("http://x/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  it("saves the name and trims it", async () => {
    mockSession.mockResolvedValue(UID);
    const sb = fakeSb();
    mockServer.mockReturnValue(sb as never);
    const res = await put({ name: "  نوید دانش  " });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ name: "نوید دانش" });
    const patch = sb.calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ display_name: "نوید دانش" });
    // Scoped to the session user — never a client-supplied id.
    expect(patch?.path).toContain(`id=eq.${UID}`);
  });

  it("rejects empty names", async () => {
    mockSession.mockResolvedValue(UID);
    mockServer.mockReturnValue(fakeSb() as never);
    const res = await put({ name: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects guests", async () => {
    mockServer.mockReturnValue(fakeSb() as never);
    const res = await put({ name: "نوید" });
    expect(res.status).toBe(401);
  });
});
