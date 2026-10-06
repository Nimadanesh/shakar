/**
 * Server-only OTP backend wiring: config + provider + store + profiles.
 * Route handlers import from here. Nothing in this file is safe for
 * client components (it touches secrets).
 */
import { getOtpConfig, type OtpConfig } from "./config";
import { buildProvider, type OtpProvider } from "./provider";
import { MemoryOtpStore, type OtpStore, SupabaseOtpStore } from "./store";
import { supabaseServer, type SupabaseServer } from "@/lib/supabase-server";

let memoryStore: MemoryOtpStore | null = null;

/** In-memory per-IP send buckets (single-instance MVP; Railway runs one). */
const ipHits = new Map<string, number[]>();
const IP_WINDOW_MS = 3600_000;
const IP_MAX_PER_HOUR = 20;

export function ipSendAllowed(ip: string, now: number): boolean {
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX_PER_HOUR) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

export interface OtpBackend {
  config: OtpConfig;
  provider: OtpProvider;
  store: OtpStore;
  sb: SupabaseServer | null;
}

export function getOtpBackend(): OtpBackend {
  const config = getOtpConfig();
  const provider = buildProvider(
    config.providerName,
    config.kavenegarApiKey,
    config.kavenegarTemplate
  );
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
