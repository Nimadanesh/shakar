/**
 * Device identity for guest hunts (blueprint §9).
 * A random UUID per browser, stored in localStorage. The server treats it
 * as a CLAIM, not proof — the abuse ladder (IP backstop) lives server-side.
 * Spoofable by design in v1; making it unspoofable is not worth the cost.
 */
const KEY = "shekaar-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) return "server";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = window.crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "server";
  }
}
