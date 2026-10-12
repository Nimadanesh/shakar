/**
 * Tombstones: records of device-local deletes, so a later server merge
 * can't resurrect them ("zombie" records). The tombstone is written at
 * delete time (works offline); the merge skips tombstoned ids; a sync
 * pushes them as server DELETEs and clears them on success.
 *
 * Kinds: favorites + hidden-ads (ad ids) and history (hunt ids / run ids).
 */
export type TombstoneKind = "favorites" | "hidden-ads" | "history";

const TOMBSTONE_CAP = 500;

function tombstoneKey(kind: TombstoneKind): string {
  return `shakar:${kind}:tombstones:v1`;
}

export function readTombstones(kind: TombstoneKind): Set<string> {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(tombstoneKey(kind));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []
    );
  } catch {
    return new Set();
  }
}

export function addTombstone(kind: TombstoneKind, id: string): void {
  try {
    if (typeof window === "undefined" || id === "") return;
    const set = readTombstones(kind);
    set.add(id);
    const arr = [...set].slice(-TOMBSTONE_CAP);
    window.localStorage.setItem(tombstoneKey(kind), JSON.stringify(arr));
  } catch {
    // Best-effort.
  }
}

export function removeTombstone(kind: TombstoneKind, id: string): void {
  try {
    if (typeof window === "undefined") return;
    const set = readTombstones(kind);
    if (!set.delete(id)) return;
    window.localStorage.setItem(tombstoneKey(kind), JSON.stringify([...set]));
  } catch {
    // Best-effort.
  }
}
