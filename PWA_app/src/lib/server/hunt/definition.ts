import "server-only";

import type { HuntDefinition } from "./pipeline";

/**
 * Validates an incoming hunt/kamin definition. Shared by POST /api/hunts
 * and the kamin APIs — one choke point, so a kamin can never watch a
 * meaning the hunt pipeline couldn't run. Null = 400 garbage.
 */
export function toHuntDefinition(body: unknown): HuntDefinition | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const query = str(b.query).trim();
  if (query === "") return null;
  const transaction = b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "";
  const condition =
    b.condition === "new" || b.condition === "used" || b.condition === "any"
      ? b.condition
      : "";
  return {
    query,
    include: strArr(b.include),
    exclude: strArr(b.exclude),
    city: str(b.city) || "all",
    category: str(b.category) || "all",
    priceMin: str(b.priceMin),
    priceMax: str(b.priceMax),
    transaction,
    condition,
    deepHistory: b.deepHistory === true,
  };
}
