import { beforeEach, describe, expect, it, vi } from "vitest";

// Tombstones + hunt delete: a deleted hunt must never zombie back via
// the profile-sync history merge, even if the server still has the run.

const store: Record<string, string> = {};

vi.stubGlobal("window", undefined);

function memStorage() {
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    dispatchEvent: () => true,
  };
}

describe("history tombstones", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("window", {
      localStorage: memStorage(),
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis);
    vi.resetModules();
  });

  it("deleteHunt tombstones the id and runId", async () => {
    const { recordHunt, deleteHunt } = await import("./hunt-store");
    const { readTombstones } = await import("./tombstones");
    const { EMPTY_CONTEXT_BASE } = await import("./search-context");
    const rec = recordHunt("پیانو", EMPTY_CONTEXT_BASE, [], "run-123");
    expect(rec).not.toBeNull();
    deleteHunt(rec!.id);
    const tombs = readTombstones("history");
    expect(tombs.has(rec!.id)).toBe(true);
    expect(tombs.has("run-123")).toBe(true);
  });

  it("deleteHunt removes the record from localStorage", async () => {
    const { recordHunt, deleteHunt, readHunts } = await import("./hunt-store");
    const { EMPTY_CONTEXT_BASE } = await import("./search-context");
    const rec = recordHunt("گیتار", EMPTY_CONTEXT_BASE);
    expect(readHunts().some((h) => h.id === rec!.id)).toBe(true);
    deleteHunt(rec!.id);
    expect(readHunts().some((h) => h.id === rec!.id)).toBe(false);
  });

  it("tombstones are capped and string-only", async () => {
    const { addTombstone, readTombstones } = await import("./tombstones");
    addTombstone("history", "a");
    addTombstone("history", "a"); // dedupe
    expect(readTombstones("history").size).toBe(1);
    // corrupt storage → empty set, no throw
    store["shakar:history:tombstones:v1"] = "not-json{{{";
    expect(readTombstones("history").size).toBe(0);
  });
});
