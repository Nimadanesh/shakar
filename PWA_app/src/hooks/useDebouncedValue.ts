"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs` after its last change. Used to
 * detect "the user stopped typing" without nagging mid-word: a suggestion
 * may only appear once the debounced value has caught up with the live one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
