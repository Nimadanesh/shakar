import { normalizeForMatch } from "@/lib/persianNormalize";

/**
 * Cross-tab search items (navid 2026-10-08): one search box over the
 * user's own data on /saved and /archive. The dealer use-case: many
 * hunts/kamins on the SAME item with DIFFERENT constraints — so every
 * result carries its constraints (قیدها) and its home tab, not just a
 * title.
 */
export type SearchItemKind =
  | "kamin"
  | "fresh"
  | "history"
  | "favorite"
  | "saved-hunt";

export interface SearchItem {
  /** Stable id for React keys. */
  id: string;
  kind: SearchItemKind;
  /** Which tab this lives in: «کمین‌ها», «تازه‌ها», «تاریخچه», ... */
  tabLabel: string;
  /** Main line: hunt query / kamin name / ad title. */
  title: string;
  /** Constraint chips (قیدها): city • category • price • include/exclude. */
  constraints: string[];
  /** Pre-normalized searchable text (title + terms + filters). */
  keywords: string;
}

export function makeKeywords(...parts: Array<string | null | undefined>): string {
  return normalizeForMatch(parts.filter(Boolean).join(" "));
}

/**
 * Live filter: every query token must appear somewhere in the item's
 * keywords. Persian-normalized on both sides (ی/ي, ک/ك, ...).
 */
export function filterSearchItems(items: SearchItem[], query: string): SearchItem[] {
  const q = normalizeForMatch(query).trim();
  if (q === "") return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((item) =>
    tokens.every((t) => item.keywords.includes(t))
  );
}

export const KIND_ORDER: Record<SearchItemKind, number> = {
  fresh: 0,
  kamin: 1,
  history: 2,
  favorite: 3,
  "saved-hunt": 4,
};

export function sortSearchItems(items: SearchItem[]): SearchItem[] {
  return [...items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
