/**
 * Seen ads (device-local). When the user opens an ad's detail, its id is
 * recorded; result cards then show a quiet "دیده شد" marker so the user
 * can tell reviewed ads apart at a glance. Ephemeral by design — clearing
 * site data resets it, which is fine.
 */
const KEY = "shakar:seen-ads:v1";
const MAX = 500;

function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function markAdSeen(adId: string): void {
  try {
    const seen = read();
    seen.add(adId);
    // Bound the size: drop oldest inserts first.
    const arr = [...seen];
    const trimmed = arr.slice(Math.max(0, arr.length - MAX));
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function isAdSeen(adId: string): boolean {
  try {
    return read().has(adId);
  } catch {
    return false;
  }
}
