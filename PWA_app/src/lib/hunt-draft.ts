import type { ContextBase } from "@/lib/search-context";

/**
 * Hunt draft: the in-progress hunt definition, persisted device-locally so
 * navigating away from the home form (accidental tap, tab switch) never
 * loses what the user typed. Restored on mount; cleared when the hunt
 * fires or when the user taps the × in the «چی؟» field.
 *
 * Only the definition draft is stored — UI states (open sheets, firing,
 * errors) are never persisted.
 */
export interface HuntDraft {
  query: string;
  base: ContextBase;
  cityTouched: boolean;
  dismissed: string[];
  ts: number;
}

const KEY = "shakar:hunt-draft:v1";

function isValidBase(b: unknown): b is ContextBase {
  if (typeof b !== "object" || b === null) return false;
  const v = b as Record<string, unknown>;
  return (
    typeof v.category === "string" &&
    typeof v.city === "string" &&
    typeof v.priceMin === "string" &&
    typeof v.priceMax === "string" &&
    Array.isArray(v.include) &&
    Array.isArray(v.exclude)
  );
}

export function readDraft(): HuntDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<HuntDraft>;
    if (typeof d.query !== "string" || !isValidBase(d.base)) return null;
    return {
      query: d.query,
      base: d.base,
      cityTouched: d.cityTouched === true,
      dismissed: Array.isArray(d.dismissed)
        ? d.dismissed.filter((x): x is string => typeof x === "string")
        : [],
      ts: typeof d.ts === "number" ? d.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<HuntDraft, "ts">): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, ts: Date.now() }));
  } catch {
    // Best-effort: the form works without persistence.
  }
}

export function clearDraft(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * True when the form holds user-entered data worth keeping / clearing.
 * An untouched home-city default is NOT data — it's the standing default.
 */
export function draftHasData(
  d: Pick<HuntDraft, "query" | "base" | "cityTouched" | "dismissed">,
  homeCityDefault: string
): boolean {
  if (d.query.trim() !== "") return true;
  if (d.cityTouched || d.dismissed.length > 0) return true;
  const b = d.base;
  return (
    b.include.length > 0 ||
    b.exclude.length > 0 ||
    b.category !== "all" ||
    (b.city !== "all" && b.city !== homeCityDefault) ||
    b.priceMin !== "" ||
    b.priceMax !== "" ||
    b.hasImage ||
    b.transaction !== "" ||
    b.condition !== ""
  );
}
