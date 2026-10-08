"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { takeTaskReturn, taskReturnMatches } from "@/lib/task-return";

/**
 * Task-continuity scroll restore. The task page (hunt results) calls this
 * once on mount: if a task return was recorded for this page (user went to
 * an ad's detail, or through the auth gate, and came back), the exact
 * scroll position is restored after paint. Otherwise nothing happens.
 *
 * The slot is consumed on first read, so a fresh visit never inherits a
 * stale scroll position.
 */
export function useTaskReturnRestore(enabled: boolean = true) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;
    const tr = takeTaskReturn();
    if (!tr) return;
    if (!taskReturnMatches(tr, pathname)) return;
    if (tr.scrollY <= 0) return;
    // The results list may still be rendering — retry until the page is
    // tall enough or we give up (10 tries × 300ms).
    let tries = 0;
    const attempt = () => {
      tries += 1;
      window.scrollTo(0, tr.scrollY);
      const done =
        window.scrollY >= tr.scrollY - 4 ||
        document.documentElement.scrollHeight <= tr.scrollY + window.innerHeight ||
        tries >= 10;
      if (!done) timer = window.setTimeout(attempt, 300);
    };
    let timer = window.setTimeout(attempt, 60);
    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);
}
