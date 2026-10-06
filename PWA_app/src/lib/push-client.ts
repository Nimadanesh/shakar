/**
 * Client-side Web Push subscription (M5).
 *
 * Call on an EXPLICIT user action (e.g. arming a kamin) — never silently.
 * Registers /push-sw.js, subscribes via pushManager, and stores the
 * subscription server-side. Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSubscribeState =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "not-configured"
  | "error";

export async function ensurePushSubscription(): Promise<PushSubscribeState> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return "not-configured";
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return "error";
  }
  if (permission !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return res.ok ? "subscribed" : "error";
  } catch {
    return "error";
  }
}
