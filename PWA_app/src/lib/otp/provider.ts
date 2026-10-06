/**
 * OTP delivery provider abstraction. Kavenegar is the production provider
 * (verify/lookup API, purpose-built for OTP); MockProvider is development
 * only and clearly labeled. Swapping providers = one new class + one env
 * value, never a rewrite of the routes.
 */

export class OtpProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "OtpProviderError";
    this.retryable = retryable;
  }
}

export interface OtpProvider {
  readonly name: string;
  /** Sends the code. Throws OtpProviderError on failure. */
  sendCode(mobile: string, code: string): Promise<void>;
}

const KAVENEGAR_TIMEOUT_MS = 8000;

async function postForm(
  url: string,
  params: Record<string, string>,
  timeoutMs: number
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new OtpProviderError(
        `Kavenegar HTTP ${res.status}`,
        res.status >= 500 || res.status === 429
      );
    }
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof OtpProviderError) throw err;
    throw new OtpProviderError(
      err instanceof Error ? `Kavenegar network: ${err.message}` : "Kavenegar network error",
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kavenegar verify/lookup: sends `code` through the panel-approved
 * `template` to `mobile` (09xxxxxxxxx). One retry on transient failures
 * only — never spin-retry against the provider.
 */
export class KavenegarProvider implements OtpProvider {
  readonly name = "kavenegar";
  constructor(
    private readonly apiKey: string,
    private readonly template: string
  ) {}

  async sendCode(mobile: string, code: string): Promise<void> {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`;
    const params = { receptor: mobile, token: code, template: this.template };
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = (await postForm(url, params, KAVENEGAR_TIMEOUT_MS)) as {
          return?: { status?: number; message?: string };
        };
        const status = data?.return?.status;
        if (status === 200) return;
        throw new OtpProviderError(
          `Kavenegar rejected the send (status ${String(status ?? "?")}: ${data?.return?.message ?? "no message"})`,
          false
        );
      } catch (err) {
        lastErr = err;
        if (!(err instanceof OtpProviderError) || !err.retryable) throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new OtpProviderError("Kavenegar send failed");
  }
}

/** Development only: logs the code server-side, delivers nothing. */
export class MockProvider implements OtpProvider {
  readonly name = "mock";
  async sendCode(mobile: string, code: string): Promise<void> {
    console.info(`[otp:mock] code for ${mobile}: ${code}`);
  }
}

export function buildProvider(
  name: "kavenegar" | "mock",
  apiKey: string | null,
  template: string | null
): OtpProvider {
  if (name === "kavenegar") {
    if (!apiKey || !template) {
      throw new OtpProviderError("Kavenegar misconfigured: API key and template are required");
    }
    return new KavenegarProvider(apiKey, template);
  }
  return new MockProvider();
}
