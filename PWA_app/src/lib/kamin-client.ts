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
