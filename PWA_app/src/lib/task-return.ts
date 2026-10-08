/**
 * Task-continuity navigation (navid 2026-10-08).
 *
 * The problem: the user is mid-TASK (reviewing hunt results, liking an ad)
 * and gets diverted — auth gate, ad detail, an accidental tap. A linear
 * back-stack ("press back N times") is the wrong model: what the user
 * wants is to resume the TASK exactly where they left it — same page,
 * same scroll, pending action applied.
 *
 * The mechanism is a single session-scoped return slot (not a stack):
 * - setTaskReturn() records { url, scrollY, pendingFavorite } when the
 *   user is diverted;
 * - the diverting flow (auth, ad detail back-link) navigates to url;
 * - the task page (HuntProgress) takes the slot on mount and restores
 *   scroll + applies the pending favorite.
 *
 * Why a single slot, not a stack: each new task context overwrites the
 * previous one. Stacking returns would recreate the "back back back"
 * maze navid explicitly rejected. The slot goes stale after 10 minutes —
 * a task abandoned that long is a new visit, not a continuation.
 */
const KEY = "shakar:task-return:v1";
const MAX_AGE_MS = 10 * 60 * 1000;

export interface TaskReturn {
  /** Full path + query of the task page, e.g. "/hunt/abc?q=..." */
  url: string;
  scrollY: number;
  /** Favorite to apply once auth completes (guest → like flow). */
  pendingFavorite?: string;
  ts: number;
}

function read(): TaskReturn | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TaskReturn>;
    if (typeof parsed.url !== "string" || typeof parsed.scrollY !== "number") return null;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > MAX_AGE_MS) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return {
      url: parsed.url,
      scrollY: parsed.scrollY,
      pendingFavorite: typeof parsed.pendingFavorite === "string" ? parsed.pendingFavorite : undefined,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

/** Record the current task position before a diverting navigation. */
export function setTaskReturn(r: { url: string; scrollY: number; pendingFavorite?: string }): void {
  try {
    const value: TaskReturn = { ...r, ts: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Read without consuming (auth needs to peek before navigating). */
export function peekTaskReturn(): TaskReturn | null {
  if (typeof window === "undefined") return null;
  return read();
}

/** Read and consume — the task page calls this once on mount. */
export function takeTaskReturn(): TaskReturn | null {
  if (typeof window === "undefined") return null;
  const found = read();
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return found;
}

export function clearTaskReturn(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Does this task return belong to the current page? Matches on pathname
 * only — query params may legitimately differ (e.g. back-link without ?q=).
 */
export function taskReturnMatches(tr: TaskReturn, pathname: string): boolean {
  return tr.url.split("?")[0] === pathname;
}
