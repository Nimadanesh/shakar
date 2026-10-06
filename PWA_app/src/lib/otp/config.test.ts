import { afterEach, describe, expect, it, vi } from "vitest";
import { getOtpConfig } from "@/lib/otp/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getOtpConfig", () => {
  it("is ready in dev with safe defaults (mock provider)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const c = getOtpConfig();
    expect(c.isProd).toBe(false);
    expect(c.ready).toBe(true);
    expect(c.providerName).toBe("mock");
  });

  it("fails closed in production when anything is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    const c = getOtpConfig();
    expect(c.isProd).toBe(true);
    expect(c.ready).toBe(false);
    expect(c.missing).toContain("OTP_PROVIDER=kavenegar");
    expect(c.missing).toContain("KAVENEGAR_API_KEY");
    expect(c.missing).toContain("SESSION_SECRET");
  });

  it("is ready in production only with the full set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OTP_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "k");
    vi.stubEnv("KAVENEGAR_TEMPLATE", "t");
    vi.stubEnv("SESSION_SECRET", "s");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const c = getOtpConfig();
    expect(c.ready).toBe(true);
    expect(c.missing).toEqual([]);
  });
});
