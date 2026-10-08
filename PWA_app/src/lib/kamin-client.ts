/**
 * Client for the server Kamin APIs (M5B).
 *
 * The backend (M5A) is done: POST /api/kamins arms a kamin server-side
 * with slot enforcement, dedupe, and sleeping-kamin support.
 * This module is the client half.
 */

export interface ArmKaminResult {
  ok: boolean;
  /** The server kamin (on success). */
  kamin?: {
    id: string;
    name: string;
    status: string;
  };
  /** True if a new kamin was created (false = existing deduped). */
  created?: boolean;
  /** Error code from the API (auth-required, slots-full, bad-definition, ...). */
  error?: string;
  /** Persian message from the API (when available). */
  message?: string;
}

/**
 * Arm a kamin on the server.
 * @param definition The hunt definition (SearchContext serializes directly).
 * @param name Display name for the kamin.
 * @param seenIds Baseline ad IDs already seen.
 */
export async function armKaminServer(
  definition: unknown,
  name: string,
  seenIds: string[]
): Promise<ArmKaminResult> {
  try {
    const res = await fetch("/api/kamins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definition, name, seenIds }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      data?: { kamin: { id: string; name: string; status: string }; created: boolean };
      error?: string;
      message?: string;
    };
    if (!data.ok) {
      return { ok: false, error: data.error ?? "unknown", message: data.message };
    }
    invalidateKaminsServerCache();
    return {
      ok: true,
      kamin: data.data?.kamin,
      created: data.data?.created,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * Persian error message for arm failures.
 * Returns null when the caller should fall back to local-only silently
 * (e.g. not-configured in dev) vs showing the user an honest message.
 */
export function armErrorMessage(error: string | undefined): string | null {
  switch (error) {
    case "auth-required":
      return "برای فعال‌سازی کمین وارد شوید.";
    case "slots-full":
      // The API already returns a Persian message; prefer it when present.
      return null;
    case "bad-definition":
      return "تعریف شکار معتبر نیست.";
    case "not-configured":
      return null; // dev fallback to local
    case "network":
      return "اتصال برقرار نشد — کمین به‌صورت محلی ذخیره شد.";
    default:
      return "خطایی رخ داد.";
  }
}

export interface ServerKamin {
  id: string;
  name: string;
  status: "active" | "sleeping";
  cadence: string;
  new_match_count: number;
  last_checked_at: string | null;
  armed_at: string;
  definition: {
    query: string;
    include?: string[];
    exclude?: string[];
    city?: string;
    category?: string;
    priceMin?: number | null;
    priceMax?: number | null;
  };
}

/**
 * List kamins from the server. Returns null on auth failure or network
 * error (caller falls back to local).
 *
 * Shared module-wide: /saved and /archive both fetch on every mount (tab
 * switches remount), so one cached read serves both instead of N identical
 * GETs. 30s TTL; invalidated by arm/disarm below.
 */
let kaminsFetch: Promise<ServerKamin[] | null> | null = null;
let kaminsFetchedAt = 0;
const KAMINS_TTL_MS = 30_000;

export function invalidateKaminsServerCache(): void {
  kaminsFetch = null;
  kaminsFetchedAt = 0;
}

export async function listKaminsServer(): Promise<ServerKamin[] | null> {
  const now = Date.now();
  if (kaminsFetch && now - kaminsFetchedAt < KAMINS_TTL_MS) return kaminsFetch;
  kaminsFetchedAt = now;
  kaminsFetch = (async () => {
    try {
      const res = await fetch("/api/kamins", { method: "GET" });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        ok: boolean;
        data?: { kamins: ServerKamin[] };
      };
      if (!data.ok || !data.data) return null;
      return data.data.kamins;
    } catch {
      return null;
    }
  })();
  kaminsFetch.catch(() => {
    kaminsFetch = null;
    kaminsFetchedAt = 0;
  });
  return kaminsFetch;
}

/**
 * Disarm (delete) a kamin on the server. Returns true on success.
 */
export async function disarmKaminServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/kamins/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) invalidateKaminsServerCache();
    return res.ok;
  } catch {
    return false;
  }
}

export interface KaminRun {
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | "baseline";
  pages_fetched: number;
  candidates: number;
  new_count: number;
}

export interface KaminActivity {
  runs: KaminRun[];
  totalRuns: number;
  totalNew: number;
  degraded: boolean;
}

/**
 * The kamin's work diary for the detail sheet. Returns null when
 * unreachable — the sheet then shows the definition without the diary,
 * honestly.
 */
export async function fetchKaminActivity(id: string): Promise<KaminActivity | null> {
  try {
    const res = await fetch(`/api/kamins/${encodeURIComponent(id)}/activity`, {
      method: "GET",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; data?: KaminActivity };
    if (!data.ok || !data.data) return null;
    return data.data;
  } catch {
    return null;
  }
}
