import { mentionsRealEstate } from "@/lib/interpret";
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
  /** Real-estate transaction type chosen by the user. "" = unresolved. */
  transaction: "" | "rent" | "buy";
}

export const EMPTY_CONTEXT_BASE: ContextBase = {
  category: "all",
  city: "all",
  priceMin: "",
  priceMax: "",
  include: [],
  exclude: [],
  hasImage: false,
  transaction: "",
};

/**
 * The single source of truth for city geo-semantics (M3 contract):
 * location-bound categories filter hard, everything else only boosts.
 * null when no city is set. Never duplicated — callers derive, never guess.
 */
export function cityScopeFor(
  city: string,
  category: string,
  query: string
): SearchContext["cityScope"] {
  if (city === "all") return null;
  const locationBound =
    category === "real-estate" ||
    category === "vehicles" ||
    mentionsRealEstate(query);
  return locationBound ? "hard" : "soft";
}

/**
 * Merge explicit user refinements with inferred interpretation.
 * Explicit wins — except for city, where the query text is the freshest
 * signal and overrides a stored preference (flagged as inferred in the UI).
 * Dismissed inferred constraints stay off until the raw query changes.
 * Preferences never enter the context.
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
  // The query text is the freshest signal of intent: a city named in the
  // text wins over the stored preference (remembered or explicitly picked
  // earlier this session) — same principle as the transaction rule below.
  // The form flags it as inferred (dashed «حدسی») so the conflict is
  // visible; dismissing restores the stored city. A stored city only stands
  // while the text stays silent about location.
  const inferredCity = inferred("city");
  if (inferredCity) city = inferredCity.value;

  // Geo semantics for the M3 backend live in cityScopeFor — one mapping,
  // never duplicated or guessed at the call site.
  const cityScope = cityScopeFor(city, base.category, query);

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

  // Transaction: the query text is the freshest signal of intent —
  // a chip choice only stands while the text stays silent. (Chips only
  // render when the text has no transaction word, so this is the
  // user-editing-their-mind case, not a conflict.)
  let transaction: "" | "rent" | "buy" = "";
  const inferredTx = inferred("transaction");
  if (inferredTx && (inferredTx.value === "rent" || inferredTx.value === "buy")) {
    transaction = inferredTx.value;
  } else if (base.transaction === "rent" || base.transaction === "buy") {
    transaction = base.transaction;
  }

  return {
    query,
    includeKeywords: include,
    excludeKeywords: exclude,
    category: base.category,
    city,
    cityScope,
    priceMin,
    priceMax,
    hasImage: base.hasImage,
    transaction,
  };
}
