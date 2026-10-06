import "server-only";

import webpush from "web-push";
import type { SupabaseServer } from "@/lib/supabase-server";
import type { PushPayload } from "./kamin/engine";

/**
 * M5 Web Push (blueprint §1.9). VAPID via env:
 *   VAPID_SUBJECT (mailto:), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * The public key is also exposed as NEXT_PUBLIC_VAPID_PUBLIC_KEY for the
 * client-side pushManager.subscribe() call.
 *
 * Fail-closed: without the full env set, sends are skipped (logged), never
 * faked. A 404/410 from the push service means the subscription is dead —
 * it is pruned so we don't keep paying attention to ghosts.
 */

let vapidReady = false;

export function pushConfigured(): boolean {
  return (
    !!process.env.VAPID_SUBJECT &&
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY
  );
}

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  vapidReady = true;
  return true;
}

interface StoredSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushToUser(
  sb: SupabaseServer | null,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  if (!sb || !ensureVapid()) {
    if (!ensureVapid()) {
      console.warn(
        "[push] VAPID not configured — skipping send (set VAPID_SUBJECT/VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)"
      );
    }
    return { sent: 0, pruned: 0 };
  }
  const subs = await sb.rest<StoredSub[]>(
    "GET",
    `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=endpoint,p256dh,auth`
  );
  let sent = 0;
  let pruned = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Dead subscription — prune it.
        try {
          await sb.rest(
            "DELETE",
            `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(s.endpoint)}`
          );
        } catch {
          /* prune is best-effort */
        }
        pruned++;
      } else {
        console.warn("[push] send failed:", (e as Error).message);
      }
    }
  }
  return { sent, pruned };
}
