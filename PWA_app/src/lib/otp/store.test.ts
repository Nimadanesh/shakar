import { describe, expect, it } from "vitest";
import { MemoryOtpStore, hashCode, safeEqual } from "@/lib/otp/store";

describe("hashCode / safeEqual", () => {
  it("is deterministic and hides the code", async () => {
    const h1 = await hashCode("12345");
    const h2 = await hashCode("12345");
    expect(h1).toBe(h2);
    expect(h1).not.toContain("12345");
    expect(await hashCode("12346")).not.toBe(h1);
  });

  it("compares in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("MemoryOtpStore", () => {
  const rec = (over: Partial<Parameters<MemoryOtpStore["create"]>[0]> = {}) => ({
    mobile: "09123456789",
    codeHash: "h",
    expiresAt: Date.now() + 60_000,
    maxAttempts: 5,
    ...over,
  });

  it("latestActive returns the newest unconsumed, unexpired record", async () => {
    const s = new MemoryOtpStore();
    const now = Date.now();
    await s.create(rec({ mobile: "09120000000", expiresAt: now - 1000 })); // expired
    const old = await s.create(rec({ mobile: "09120000000" }));
    const fresh = await s.create(rec({ mobile: "09120000000" }));
    await s.consume(old.id, now);
    expect((await s.latestActive("09120000000", now))?.id).toBe(fresh.id);
  });

  it("returns null when nothing is active", async () => {
    const s = new MemoryOtpStore();
    expect(await s.latestActive("09129999999", Date.now())).toBeNull();
  });

  it("increments attempts and consumes", async () => {
    const s = new MemoryOtpStore();
    const r = await s.create(rec());
    await s.incrementAttempts(r.id);
    expect((await s.latestActive(r.mobile, Date.now()))?.attempts).toBe(1);
    await s.consume(r.id, Date.now());
    expect(await s.latestActive(r.mobile, Date.now())).toBeNull();
  });

  it("remove drops the record (send-failure path)", async () => {
    const s = new MemoryOtpStore();
    const r = await s.create(rec());
    await s.remove(r.id);
    expect(await s.latestActive(r.mobile, Date.now())).toBeNull();
    expect(await s.sentSince(r.mobile, Date.now() - 3600_000)).toBe(0);
  });

  it("sentSince counts within the window", async () => {
    const s = new MemoryOtpStore();
    await s.create(rec({ mobile: "09121111111" }));
    await s.create(rec({ mobile: "09121111111" }));
    await s.create(rec({ mobile: "09122222222" }));
    expect(await s.sentSince("09121111111", Date.now() - 3600_000)).toBe(2);
    expect(await s.sentSince("09121111111", Date.now() + 1000)).toBe(0);
  });
});
