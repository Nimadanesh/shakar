/**
 * Server-only OTP backend wiring: config + provider + store + profiles.
 * Route handlers import from here. Nothing in this file is safe for
 * client components (it touches secrets).
 */
import { getOtpConfig, type OtpConfig } from "./config";
import { buildProvider, MockProvider, type OtpProvider } from "./provider";
import { MemoryOtpStore, type OtpStore, SupabaseOtpStore } from "./store";
import { supabaseServer, type SupabaseServer } from "@/lib/supabase-server";

let memoryStore: MemoryOtpStore | null = null;

/** In-memory per-IP send buckets: legacy fallback only (single-instance). */
const ipHits = new Map<string, number[]>();
const IP_WINDOW_MS = 3600_000;
const IP_WINDOW_SECS = 3600;
const IP_MAX_PER_HOUR = 20;

function ipSendAllowedMemory(ip: string, now: number): boolean {
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX_PER_HOUR) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

/**
 * Finding #10a: the IP send limit used to live in the Map above —
 * invisible to every other instance. Now it's one atomic statement
 * (check_otp_ip_limit RPC) against a shared table, so N instances share
 * one budget. Falls back to the in-memory check with a loud warning
 * when the m8 migration hasn't been run yet.
 */
export async function ipSendAllowed(
  sb: SupabaseServer | null,
  ip: string
): Promise<boolean> {
  if (sb) {
    try {
      const rows = await sb.rest<Array<{ allowed: boolean }>>(
        "POST",
        "/rpc/check_otp_ip_limit",
        { p_ip: ip, p_limit: IP_MAX_PER_HOUR, p_window_secs: IP_WINDOW_SECS }
      );
      if (rows.length === 0) {
        throw new Error("check_otp_ip_limit returned no rows");
      }
      return rows[0].allowed;
    } catch (e) {
      if (
        typeof e === "object" &&
        e !== null &&
        (e as { status?: unknown }).status === 404
      ) {
        console.warn(
          "[otp] check_otp_ip_limit RPC missing — in-memory IP limit " +
            "(single-instance only). Run supabase/m8-otp-atomic.sql."
        );
      } else {
        throw e;
      }
    }
  }
  return ipSendAllowedMemory(ip, Date.now());
}

export interface OtpBackend {
  config: OtpConfig;
  provider: OtpProvider;
  store: OtpStore;
  sb: SupabaseServer | null;
}

export function getOtpBackend(): OtpBackend {
  const config = getOtpConfig();
  // buildProvider throws when Kavenegar is misconfigured. Don't let that
  // crash the route before the config.ready check — return a provider that
  // fails gracefully on send instead, so the API returns a proper JSON
  // error (NOT_CONFIGURED) instead of a 500 HTML page.
  let provider: OtpProvider;
  try {
    provider = buildProvider(
      config.providerName,
      config.kavenegarApiKey,
      config.kavenegarTemplate
    );
  } catch {
    provider = new MockProvider();
  }
  const sb = supabaseServer();
  let store: OtpStore;
  if (sb) {
    store = new SupabaseOtpStore(sb.rest);
  } else {
    if (!memoryStore) memoryStore = new MemoryOtpStore();
    store = memoryStore;
  }
  return { config, provider, store, sb };
}

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Finds or creates the profile row for a verified mobile.
 * Returns the profile id (the session's userId). Requires Supabase.
 */
export async function ensureProfileId(
  sb: SupabaseServer,
  mobile: string
): Promise<string> {
  const found = await sb.rest<Array<{ id: string }>>(
    "GET",
    `/profiles?mobile=eq.${encodeURIComponent(mobile)}&select=id&limit=1`
  );
  if (found.length > 0) return found[0].id;
  try {
    const created = await sb.rest<Array<{ id: string }>>("POST", "/profiles", {
      id: newId(),
      mobile,
    });
    return created[0].id;
  } catch {
    // Lost a race with a parallel first-verify: re-read the winner.
    const retry = await sb.rest<Array<{ id: string }>>(
      "GET",
      `/profiles?mobile=eq.${encodeURIComponent(mobile)}&select=id&limit=1`
    );
    if (retry.length > 0) return retry[0].id;
    throw new Error("profile upsert failed");
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
