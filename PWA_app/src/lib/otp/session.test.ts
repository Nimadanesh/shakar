import { describe, expect, it } from "vitest";
import {
  clearSessionCookieHeader,
  mintSessionToken,
  sessionCookieHeader,
  verifySessionToken,
} from "@/lib/otp/session";

const SECRET = "test-secret-please-ignore";

describe("session tokens", () => {
  it("round-trips claims", async () => {
    const token = await mintSessionToken(
      { userId: "u-1", mobile: "09123456789" },
      SECRET
    );
    expect(await verifySessionToken(token, SECRET)).toEqual({
      userId: "u-1",
      mobile: "09123456789",
    });
  });

  it("rejects tampered tokens", async () => {
    const token = await mintSessionToken({ userId: "u-1", mobile: "09123456789" }, SECRET);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await mintSessionToken({ userId: "u-1", mobile: "09123456789" }, SECRET);
    expect(await verifySessionToken(token, "other-secret")).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-token", SECRET)).toBeNull();
  });
});

describe("session cookie headers", () => {
  it("sets httpOnly + SameSite=Lax, Secure only when asked", () => {
    const h = sessionCookieHeader("t", { secure: true, maxAge: 60 });
    expect(h).toContain("shakar_session=t");
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Secure");
    const dev = sessionCookieHeader("t", { secure: false, maxAge: 60 });
    expect(dev).not.toContain("Secure");
  });

  it("clears the cookie", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});
