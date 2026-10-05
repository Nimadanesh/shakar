"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCached,
  invalidateCached,
  onCacheInvalidated,
  setCached,
} from "@/lib/session-cache";

export interface HydratedStore<T> {
  /** Undefined until the first successful read (render a skeleton). */
  value: T | undefined;
  /** True once a value has been read at least once this session. */
  ready: boolean;
  /** Re-read from storage now (also refreshes the session cache). */
  refresh: () => void;
}

/**
 * Reads a localStorage-backed value without the navigation flash.
 *
 * First mount per session: `ready` is false until the post-mount read lands
 * (SSR-safe — the server still renders the empty state). Every later mount:
 * the session cache serves the value synchronously, so the real content
 * renders on the very first paint — no skeleton, no jump.
 *
 * The value stays fresh: store mutations call `invalidateCached(key)`, which
 * makes every mounted hook re-read immediately.
 */
export function useHydratedStore<T>(key: string, read: () => T): HydratedStore<T> {
  const readRef = useRef(read);
  // Keep the ref on the latest read without touching it during render
  // (react-hooks/refs forbids ref writes in the render phase).
  useEffect(() => {
    readRef.current = read;
  });

  const [state, setState] = useState<{ ready: boolean; value: T | undefined }>(() => {
    const cached = getCached<T>(key);
    return cached !== undefined
      ? { ready: true, value: cached }
      : { ready: false, value: undefined };
  });

  useEffect(() => {
    if (getCached<T>(key) !== undefined) return;
    let value: T;
    try {
      value = readRef.current();
    } catch {
      return; // storage unavailable — callers render skeletons/empty safely
    }
    setCached(key, value);
    setState({ ready: true, value });
  }, [key]);

  useEffect(() => {
    return onCacheInvalidated((keys) => {
      if (!keys.includes(key)) return;
      let value: T;
      try {
        value = readRef.current();
      } catch {
        return;
      }
      setCached(key, value);
      setState({ ready: true, value });
    });
  }, [key]);

  const refresh = () => {
    // Clears the cache and notifies every mounted hook for this key
    // (including this one) to re-read from storage immediately.
    invalidateCached(key);
  };

  return { value: state.value, ready: state.ready, refresh };
}
