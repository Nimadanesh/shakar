import type { ContextBase } from "@/lib/search-context";

/**
 * Shared URL serialization for hunt intent (deep links, refine-from-hunt).
 * Pure functions — the single source of truth for ?q=&inc=&exc=&cat=&city=&min=&max=&img=&tx=&cond=.
 */
export function readParams(params: URLSearchParams): { query: string; base: ContextBase } {
  const tx = params.get("tx");
  const cond = params.get("cond");
  return {
    query: params.get("q") ?? "",
    base: {
      category: params.get("cat") ?? "all",
      city: params.get("city") ?? "all",
      priceMin: params.get("min") ?? "",
      priceMax: params.get("max") ?? "",
      include: params.getAll("inc"),
      exclude: params.getAll("exc"),
      hasImage: params.get("img") === "1",
      transaction: tx === "rent" || tx === "buy" ? tx : "",
      condition: cond === "new" || cond === "used" || cond === "any" ? cond : "",
    },
  };
}

export function writeParams(query: string, base: ContextBase): string {
  const params = new URLSearchParams();
  if (query.trim() !== "") params.set("q", query.trim());
  for (const term of base.include) params.append("inc", term);
  for (const term of base.exclude) params.append("exc", term);
  if (base.category !== "all") params.set("cat", base.category);
  if (base.city !== "all") params.set("city", base.city);
  if (base.priceMin.trim() !== "") params.set("min", base.priceMin.trim());
  if (base.priceMax.trim() !== "") params.set("max", base.priceMax.trim());
  if (base.hasImage) params.set("img", "1");
  if (base.transaction === "rent" || base.transaction === "buy")
    params.set("tx", base.transaction);
  if (base.condition === "new" || base.condition === "used" || base.condition === "any")
    params.set("cond", base.condition);
  const serialized = params.toString();
  return serialized === "" ? "/" : `/?${serialized}`;
}
