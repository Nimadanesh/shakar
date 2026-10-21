import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/divar/taxonomy", () => ({
  getAllCities: vi.fn(async () => [
    { slug: "tehran", name: "تهران" },
    { slug: "bonab", name: "بناب" },
  ]),
}));

import { GET } from "./route";

describe("GET /api/cities", () => {
  it("returns the city directory including بناب", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toContainEqual({ slug: "bonab", name: "بناب" });
  });

  it("sets a short client cache header", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});
