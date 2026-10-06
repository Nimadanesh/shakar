/**
 * OTP runtime configuration. Fail-closed: in production every value below
 * is REQUIRED — a missing piece returns NOT_CONFIGURED instead of a fake
 * success. In development, safe local defaults apply (mock provider,
 * memory store, ephemeral session secret).
 */

export type OtpProviderName = "kavenegar" | "mock";

export interface OtpConfig {
  isProd: boolean;
  providerName: OtpProviderName;
  kavenegarApiKey: string | null;
  kavenegarTemplate: string | null;
  sessionSecret: string;
  supabaseUrl: string | null;
  supabaseServiceKey: string | null;
  /** True when the full production OTP path can run. */
  ready: boolean;
  /** Machine-readable reason when !ready (logged server-side, never raw secrets). */
  missing: string[];
}

let warnedDev = false;
let devSecretCache: string | null = null;

function devSecret(): string {
  if (!devSecretCache) {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    devSecretCache = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return devSecretCache;
}

export function getOtpConfig(): OtpConfig {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  const providerRaw = (process.env.OTP_PROVIDER ?? "").toLowerCase();
  const providerName: OtpProviderName =
    providerRaw === "kavenegar" ? "kavenegar" : "mock";
  const kavenegarApiKey = process.env.KAVENEGAR_API_KEY ?? null;
  const kavenegarTemplate = process.env.KAVENEGAR_TEMPLATE ?? null;

  let sessionSecret = process.env.SESSION_SECRET ?? null;
  const supabaseUrl = process.env.SUPABASE_URL ?? null;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  if (isProd) {
    if (providerName !== "kavenegar") missing.push("OTP_PROVIDER=kavenegar");
    if (!kavenegarApiKey) missing.push("KAVENEGAR_API_KEY");
    if (!kavenegarTemplate) missing.push("KAVENEGAR_TEMPLATE");
    if (!sessionSecret) missing.push("SESSION_SECRET");
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  } else {
    if (!sessionSecret) {
      if (!warnedDev) {
        warnedDev = true;
        console.warn(
          "[otp] SESSION_SECRET unset — using an ephemeral dev secret (sessions die on restart)."
        );
      }
      sessionSecret = devSecret();
    }
  }

  return {
    isProd,
    providerName,
    kavenegarApiKey,
    kavenegarTemplate,
    sessionSecret: sessionSecret as string,
    supabaseUrl,
    supabaseServiceKey,
    ready: !isProd || missing.length === 0,
    missing,
  };
}
