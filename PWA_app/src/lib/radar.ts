import type { SearchContext } from "@/types/search";
import { normalizePersian } from "@/lib/normalizePersian";

export interface RadarConfig {
  /** Stable identity derived from canonical search semantics (not raw text). */
  id: string;
  name: string;
  context: SearchContext;
  createdAt: string;
  /** Local-only intent flag. No remote monitoring exists in this phase. */
  wanted: boolean;
}

/** Canonical serialization: term order and whitespace must not change identity. */
export function canonicalKey(ctx: SearchContext): string {
  const sorted = (terms: string[]) =>
    [...terms].map((t) => normalizePersian(t)).sort();
  return JSON.stringify({
    q: normalizePersian(ctx.query),
    inc: sorted(ctx.includeKeywords),
    exc: sorted(ctx.excludeKeywords),
    cat: ctx.category,
    city: ctx.city,
    min: ctx.priceMin,
    max: ctx.priceMax,
    img: ctx.hasImage,
  });
}

function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `radar-${Math.abs(hash).toString(36)}`;
}

/** Snapshot the exact current search meaning. Never silently relax constraints. */
export function buildRadarConfig(ctx: SearchContext, name: string): RadarConfig {
  const key = canonicalKey(ctx);
  return {
    id: hashKey(key),
    name: name.trim() === "" ? ctx.query.trim().slice(0, 60) : name.trim().slice(0, 60),
    context: {
      ...ctx,
      includeKeywords: [...ctx.includeKeywords],
      excludeKeywords: [...ctx.excludeKeywords],
    },
    createdAt: new Date().toISOString(),
    wanted: true,
  };
}
