import { describe, expect, it, beforeEach } from "vitest";

import {
  getCached,
  invalidateCached,
  setCached,
} from "./session-cache";

describe("session-cache", () => {
  beforeEach(() => {
    invalidateCached("a", "b");
  });

  it("returns undefined for keys that were never set", () => {
    expect(getCached("a")).toBeUndefined();
  });

  it("round-trips values through set/get", () => {
    setCached("a", { hunts: 3 });
    expect(getCached<{ hunts: number }>("a")).toEqual({ hunts: 3 });
  });

  it("invalidateCached drops only the named keys", () => {
    setCached("a", 1);
    setCached("b", 2);
    invalidateCached("a");
    expect(getCached("a")).toBeUndefined();
    expect(getCached("b")).toBe(2);
  });

  it("invalidation without prior set is a no-op", () => {
    expect(() => invalidateCached("never-set")).not.toThrow();
    expect(getCached("never-set")).toBeUndefined();
  });

  it("does not throw when window is unavailable (SSR import)", () => {
    // The module is imported during SSR; only the event dispatch touches
    // window, and it must be guarded.
    expect(() => invalidateCached("a")).not.toThrow();
  });
});
