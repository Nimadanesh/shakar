import { categoryLabel, cityLabel } from "@/data/taxonomy";
import { formatPriceCompact } from "@/lib/prices";
import type { KaminRecord } from "@/lib/kamin-store";
import type { ServerKamin } from "@/lib/kamin-client";
import type { HuntRecord } from "@/lib/hunt-store";
import type { SavedHunt } from "@/lib/saved-hunts";
import { makeKeywords, type SearchItem } from "./search-items";

function priceConstraint(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null)
    return `از ${formatPriceCompact(min)} تا ${formatPriceCompact(max)}`;
  return max != null ? `تا ${formatPriceCompact(max)}` : `از ${formatPriceCompact(min as number)}`;
}

function baseConstraints(base: {
  city?: string;
  category?: string;
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  include?: string[];
  exclude?: string[];
}): string[] {
  const out: string[] = [];
  if (base.city && base.city !== "all") out.push(cityLabel(base.city));
  if (base.category && base.category !== "all") out.push(categoryLabel(base.category));
  const price = priceConstraint(
    typeof base.priceMin === "string" ? (base.priceMin === "" ? null : Number(base.priceMin)) : (base.priceMin ?? null),
    typeof base.priceMax === "string" ? (base.priceMax === "" ? null : Number(base.priceMax)) : (base.priceMax ?? null)
  );
  if (price) out.push(price);
  const terms = [...(base.include ?? [])];
  if (base.exclude?.length) terms.push(...base.exclude.map((t) => `نه ${t}`));
  if (terms.length > 0) out.push(terms.slice(0, 3).join("، "));
  return out;
}

/** Local kamin → search item (tab: کمین‌ها). */
export function kaminToSearchItem(kamin: KaminRecord): SearchItem {
  const constraints = baseConstraints({
    city: kamin.ctx.city,
    category: kamin.ctx.category,
    priceMin: kamin.ctx.priceMin,
    priceMax: kamin.ctx.priceMax,
    include: kamin.ctx.includeKeywords,
    exclude: kamin.ctx.excludeKeywords,
  });
  return {
    id: kamin.id,
    kind: "kamin",
    tabLabel: "کمین‌ها",
    title: kamin.name,
    constraints,
    keywords: makeKeywords(kamin.name, kamin.ctx.query, ...constraints),
  };
}

/** Server kamin → search item (tab: کمین‌ها / تازه‌ها). */
export function serverKaminToSearchItem(
  kamin: ServerKamin,
  kind: "kamin" | "fresh"
): SearchItem {
  const d = kamin.definition;
  const constraints = baseConstraints({
    city: d.city,
    category: d.category,
    priceMin: d.priceMin,
    priceMax: d.priceMax,
    include: d.include,
    exclude: d.exclude,
  });
  return {
    id: kamin.id,
    kind,
    tabLabel: kind === "fresh" ? "تازه‌ها" : "کمین‌ها",
    title: kamin.name,
    constraints,
    keywords: makeKeywords(kamin.name, d.query, ...constraints),
  };
}

/** Hunt history record → search item (tab: تاریخچه). */
export function huntToSearchItem(hunt: HuntRecord): SearchItem {
  const constraints = baseConstraints({
    city: hunt.base.city,
    category: hunt.base.category,
    priceMin: hunt.base.priceMin,
    priceMax: hunt.base.priceMax,
    include: hunt.base.include,
    exclude: hunt.base.exclude,
  });
  return {
    id: hunt.id,
    kind: "history",
    tabLabel: "تاریخچه",
    title: hunt.query,
    constraints,
    keywords: makeKeywords(hunt.query, ...constraints),
  };
}

/** Saved hunt definition → search item (tab: ذخیره‌شده‌ها). */
export function savedHuntToSearchItem(hunt: SavedHunt): SearchItem {
  const constraints = baseConstraints({
    city: hunt.base.city,
    category: hunt.base.category,
    priceMin: hunt.base.priceMin,
    priceMax: hunt.base.priceMax,
    include: hunt.base.include,
    exclude: hunt.base.exclude,
  });
  return {
    id: hunt.id,
    kind: "saved-hunt",
    tabLabel: "ذخیره‌شده‌ها",
    title: hunt.query,
    constraints,
    keywords: makeKeywords(hunt.query, ...constraints),
  };
}

/** Favorite ad (title resolved via API) → search item (tab: علاقه‌مندی‌ها). */
export function favoriteToSearchItem(
  adId: string,
  title: string,
  city: string | null
): SearchItem {
  const constraints = city ? [city] : [];
  return {
    id: adId,
    kind: "favorite",
    tabLabel: "علاقه‌مندی‌ها",
    title,
    constraints,
    keywords: makeKeywords(title, city),
  };
}
