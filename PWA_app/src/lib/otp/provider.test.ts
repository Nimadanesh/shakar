import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KavenegarProvider,
  MockProvider,
  OtpProviderError,
  buildProvider,
} from "@/lib/otp/provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }))
  );
}

describe("KavenegarProvider", () => {
  it("sends receptor/token/template to verify/lookup", async () => {
    mockFetchOnce({ return: { status: 200, message: "success" } });
    const p = new KavenegarProvider("KEY", "shakar-otp");
    await p.sendCode("09123456789", "12345");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.kavenegar.com/v1/KEY/verify/lookup.json");
    const params = new URLSearchParams(init.body as string);
    expect(params.get("receptor")).toBe("09123456789");
    expect(params.get("token")).toBe("12345");
    expect(params.get("template")).toBe("shakar-otp");
  });

  it("throws without retry when Kavenegar rejects (4xx)", async () => {
    mockFetchOnce({ return: { status: 400, message: "invalid template" } });
    const p = new KavenegarProvider("KEY", "bad-template");
    await expect(p.sendCode("09123456789", "12345")).rejects.toThrow(OtpProviderError);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("retries once on transient (5xx) then throws", async () => {
    mockFetchOnce({ return: { status: 500, message: "busy" } }, 500);
    const p = new KavenegarProvider("KEY", "shakar-otp");
    await expect(p.sendCode("09123456789", "12345")).rejects.toThrow(OtpProviderError);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("buildProvider refuses kavenegar without key/template", () => {
    expect(() => buildProvider("kavenegar", null, null)).toThrow(OtpProviderError);
    expect(() => buildProvider("kavenegar", "k", null)).toThrow(OtpProviderError);
  });
});

describe("MockProvider", () => {
  it("resolves without network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await new MockProvider().sendCode("09123456789", "12345");
    expect(spy).not.toHaveBeenCalled();
  });
});
