import { DIVAR_CITIES } from "../divarCities.ts";
import { canonicalizeForMatch } from "./persian-canonicalize.ts";
import type { IntentContract, IntentSlot } from "./intent-contract";

export type Stage3QueryKind = "base" | "narrow";
export type Stage3QueryStatus = "queued" | "skipped-duplicate";

export interface Stage3QueryPlanEntry {
  /** Stable, deterministic order across the full replay. */
  readonly order: number;
  readonly huntId: string;
  readonly kind: Stage3QueryKind;
  readonly entityAlternativeIndex: number;
  readonly hardSlotValues: readonly string[];
  readonly query: string;
  /** null means no city filter is safe to apply. */
  readonly city_ids: readonly string[] | null;
  readonly status: Stage3QueryStatus;
  readonly reason: "ready" | "adds-no-new-words" | "no-hard-spec-slots";
}

export interface Stage3QueryPlan {
  readonly entries: readonly Stage3QueryPlanEntry[];
  /** Known city slugs missing from the frozen Divar slug-to-numeric-ID map. */
  readonly unmappedCitySlugs: readonly string[];
  readonly summary: {
    readonly baseQueries: number;
    readonly narrowQueries: number;
    readonly skippedDuplicate: number;
    readonly emittedQueries: number;
  };
}

const EXCLUDED_QUERY_SLOT_KINDS = new Set(["condition", "location", "category", "price"]);

function splitAlternatives(value: string): string[] {
  return value.split(" یا ").map((part) => part.trim()).filter(Boolean);
}

function normalizedTokens(value: string): Set<string> {
  return new Set(canonicalizeForMatch(value).tokens);
}

function addsNewWords(base: string, candidate: string): boolean {
  const baseTokens = normalizedTokens(base);
  return [...normalizedTokens(candidate)].some((token) => !baseTokens.has(token));
}

function hardUnconditionalSlots(contract: IntentContract): IntentSlot[] {
  return contract.slots.filter((slot) =>
    slot.polarity === "must" &&
    slot.hardness === "hard" &&
    slot.status === "confirmed" &&
    !EXCLUDED_QUERY_SLOT_KINDS.has(slot.kind.trim().toLowerCase())
  );
}

function resolveCityIds(
  contract: IntentContract,
  cityIdsBySlug: Readonly<Record<string, string>>,
): { readonly city_ids: readonly string[] | null; readonly unmappedCitySlugs: readonly string[] } {
  const locationSlot = contract.slots.find((slot) => slot.kind.trim().toLowerCase() === "location");
  if (!locationSlot || locationSlot.hardness !== "hard" || locationSlot.status !== "confirmed") {
    return { city_ids: null, unmappedCitySlugs: [] };
  }

  const byCanonicalName = new Map<string, Set<string>>();
  for (const city of DIVAR_CITIES) {
    for (const name of city.names) {
      const key = canonicalizeForMatch(name).canonical;
      const slugs = byCanonicalName.get(key) ?? new Set<string>();
      slugs.add(city.id);
      byCanonicalName.set(key, slugs);
    }
  }

  const ids = new Set<string>();
  const unmappedCitySlugs = new Set<string>();
  for (const value of locationSlot.values) {
    const parts = splitAlternatives(value);
    for (const part of parts) {
      // "اطراف" is a service-area qualifier, not a separate Divar city.
      // Keep the explicitly named city as the hard retrieval boundary.
      if (part === "اطراف" && parts.length > 1) continue;
      const slugs = byCanonicalName.get(canonicalizeForMatch(part).canonical);
      // An unrecognized name cannot safely be translated to a Divar city.
      if (!slugs || slugs.size === 0) {
        return { city_ids: null, unmappedCitySlugs: [...unmappedCitySlugs].sort() };
      }
      for (const slug of slugs) {
        const id = cityIdsBySlug[slug];
        if (typeof id !== "string" || !/^\\d+$/.test(id)) {
          unmappedCitySlugs.add(slug);
          continue;
        }
        ids.add(id);
      }
    }
  }
  const unmapped = [...unmappedCitySlugs].sort();
  return {
    city_ids: unmapped.length > 0 || ids.size === 0 ? null : [...ids].sort((a, b) => Number(a) - Number(b)),
    unmappedCitySlugs: unmapped,
  };
}

function combinations(valuesBySlot: readonly (readonly string[])[]): string[][] {
  return valuesBySlot.reduce<string[][]>(
    (current, values) => current.flatMap((prefix) => values.map((value) => [...prefix, value])),
    [[]],
  );
}

/**
 * Stage 3 query derivation only: this module never performs network requests,
 * judges listings, filters results, or mutates the approved source contracts.
 */
export function deriveStage3QueryPlan(
  contracts: readonly IntentContract[],
  cityIdsBySlug: Readonly<Record<string, string>>,
): Stage3QueryPlan {
  const entries: Stage3QueryPlanEntry[] = [];
  const unmappedCitySlugs = new Set<string>();

  for (const contract of contracts) {
    const cityResolution = resolveCityIds(contract, cityIdsBySlug);
    const city_ids = cityResolution.city_ids;
    for (const slug of cityResolution.unmappedCitySlugs) unmappedCitySlugs.add(slug);
    const entityAlternatives = contract.entity.values.flatMap(splitAlternatives);
    const hardSlots = hardUnconditionalSlots(contract);
    // Split OR alternatives inside each specification slot before the Cartesian product.
    const hardCombinations = combinations(hardSlots.map((slot) => slot.values.flatMap(splitAlternatives)));

    for (let entityIndex = 0; entityIndex < entityAlternatives.length; entityIndex += 1) {
      const entity = entityAlternatives[entityIndex];
      entries.push({
        order: entries.length + 1,
        huntId: contract.huntId,
        kind: "base",
        entityAlternativeIndex: entityIndex,
        hardSlotValues: [],
        query: entity,
        city_ids,
        status: "queued",
        reason: "ready",
      });

      if (hardSlots.length === 0) {
        entries.push({
          order: entries.length + 1,
          huntId: contract.huntId,
          kind: "narrow",
          entityAlternativeIndex: entityIndex,
          hardSlotValues: [],
          query: entity,
          city_ids,
          status: "skipped-duplicate",
          reason: "no-hard-spec-slots",
        });
        continue;
      }

      for (const hardSlotValues of hardCombinations) {
        const query = [entity, ...hardSlotValues].join(" ").replace(/\s+/g, " ").trim();
        const duplicate = !addsNewWords(entity, query);
        entries.push({
          order: entries.length + 1,
          huntId: contract.huntId,
          kind: "narrow",
          entityAlternativeIndex: entityIndex,
          hardSlotValues,
          query,
          city_ids,
          status: duplicate ? "skipped-duplicate" : "queued",
          reason: duplicate ? "adds-no-new-words" : "ready",
        });
      }
    }
  }

  const baseQueries = entries.filter((entry) => entry.kind === "base").length;
  const narrowQueries = entries.filter((entry) => entry.kind === "narrow" && entry.status === "queued").length;
  const skippedDuplicate = entries.filter((entry) => entry.status === "skipped-duplicate").length;
  return {
    entries,
    unmappedCitySlugs: [...unmappedCitySlugs].sort(),
    summary: {
      baseQueries,
      narrowQueries,
      skippedDuplicate,
      emittedQueries: baseQueries + narrowQueries,
    },
  };
}
