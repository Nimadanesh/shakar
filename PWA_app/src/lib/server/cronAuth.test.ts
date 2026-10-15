import { afterEach, describe, expect, it } from "vitest";
import { checkCronSecret } from "./cronAuth";

function reqWith(secret: string | null): Request {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-cron-secret"] = secret;
  return new Request("https://example.com/", { headers });
}

describe("checkCronSecret (M3)", () => {
  const OLD = process.env.CRON_SECRET;
  afterEach(() => {
    if (OLD === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = OLD;
  });

  it("accepts the correct secret (trims both sides)", () => {
    process.env.CRON_SECRET = "s3cr3t ";
    expect(checkCronSecret(reqWith("s3cr3t")).ok).toBe(true);
    expect(checkCronSecret(reqWith(" s3cr3t\n")).ok).toBe(true);
  });

  it("rejects a wrong secret with 403", () => {
    process.env.CRON_SECRET = "s3cr3t";
    const res = checkCronSecret(reqWith("wrong"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toBe("forbidden");
    }
  });

  it("rejects a missing header with 403", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(checkCronSecret(reqWith(null)).ok).toBe(false);
  });

  it("fails closed with 503 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const res = checkCronSecret(reqWith("anything"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
  });
});
