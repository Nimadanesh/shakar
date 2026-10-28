import approvedContracts from "./data/draft-contracts-70.json" with { type: "json" };
import { DIVAR_CITIES, type DivarCityEntry } from "../divarCities";
import { canonicalizeForMatch } from "./persian-canonicalize";
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
  cities: readonly DivarCityEntry[],
): readonly string[] | null {
  const locationSlot = contract.slots.find((slot) => slot.kind.trim().toLowerCase() === "location");
  if (!locationSlot || locationSlot.hardness !== "hard" || locationSlot.status !== "confirmed") {
    return null;
  }

  const byCanonicalName = new Map<string, Set<string>>();
  for (const city of cities) {
    for (const name of city.names) {
      const key = canonicalizeForMatch(name).canonical;
      const ids = byCanonicalName.get(key) ?? new Set<string>();
      ids.add(city.id);
      byCanonicalName.set(key, ids);
    }
  }

  const ids = new Set<string>();
  for (const value of locationSlot.values) {
    for (const part of splitAlternatives(value)) {
      const mappedIds = byCanonicalName.get(canonicalizeForMatch(part).canonical);
      // One unmappable OR component invalidates the entire city filter.
      if (!mappedIds || mappedIds.size === 0) return null;
      for (const id of mappedIds) ids.add(id);
    }
  }
  return ids.size > 0 ? [...ids] : null;
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
  contracts: readonly IntentContract[] = approvedContracts.contracts as IntentContract[],
  cities: readonly DivarCityEntry[] = DIVAR_CITIES,
): Stage3QueryPlan {
  const entries: Stage3QueryPlanEntry[] = [];

  for (const contract of contracts) {
    const city_ids = resolveCityIds(contract, cities);
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
    summary: {
      baseQueries,
      narrowQueries,
      skippedDuplicate,
      emittedQueries: baseQueries + narrowQueries,
    },
  };
}
