import { parsePriceInput } from "@/lib/prices";
import type { Interpretation, SearchContext } from "@/types/search";

export interface ContextBase {
  category: string;
  city: string;
  priceMin: string;
  priceMax: string;
  include: string[];
  exclude: string[];
  hasImage: boolean;
}

export const EMPTY_CONTEXT_BASE: ContextBase = {
  category: "all",
  city: "all",
  priceMin: "",
  priceMax: "",
  include: [],
  exclude: [],
  hasImage: false,
};

/**
 * Merge explicit user refinements with inferred interpretation.
 * Explicit always wins; dismissed inferred constraints stay off until the
 * raw query changes. Preferences never enter the context.
 */
export function buildEffectiveContext(
  query: string,
  base: ContextBase,
  interpretation: Interpretation,
  dismissed: ReadonlySet<string>
): SearchContext {
  const inferred = (kind: string) =>
    interpretation.applied.find((c) => c.kind === kind && !dismissed.has(c.id));

  const include = [...base.include];
  const exclude = [...base.exclude];
  for (const c of interpretation.applied) {
    if (c.kind === "exclude" && !dismissed.has(c.id) && !exclude.includes(c.value)) {
      exclude.push(c.value);
    }
  }

  let city = base.city;
  if (city === "all") {
    const inferredCity = inferred("city");
    if (inferredCity) city = inferredCity.value;
  }

  let priceMin = parsePriceInput(base.priceMin);
  if (priceMin === null) {
    const inferredMin = inferred("priceMin");
    if (inferredMin) priceMin = Number(inferredMin.value);
  }
  let priceMax = parsePriceInput(base.priceMax);
  if (priceMax === null) {
    const inferredMax = inferred("priceMax");
    if (inferredMax) priceMax = Number(inferredMax.value);
  }

  return {
    query,
    includeKeywords: include,
    excludeKeywords: exclude,
    category: base.category,
    city,
    priceMin,
    priceMax,
    hasImage: base.hasImage,
  };
}
