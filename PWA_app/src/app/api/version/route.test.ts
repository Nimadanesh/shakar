import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/version", () => {
  it("returns the deployed commit and branch without cacheable responses", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "railway-test-sha");
    vi.stubEnv("RAILWAY_GIT_BRANCH", "main");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toEqual({
      ok: true,
      service: "shakar",
      commitSha: "railway-test-sha",
      branch: "main",
    });
  });

  it("supports the equivalent Vercel metadata fallback", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", undefined);
    vi.stubEnv("RAILWAY_GIT_BRANCH", undefined);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "vercel-test-sha");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");

    const response = await GET();
    const body = await response.json();

    expect(body.commitSha).toBe("vercel-test-sha");
    expect(body.branch).toBe("main");
  });
});
