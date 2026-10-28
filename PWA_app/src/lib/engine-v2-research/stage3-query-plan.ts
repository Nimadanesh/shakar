import approvedContracts from "./data/draft-contracts-70.json";
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
  readonly reason: "ready" | "adds-no-new-words";
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
  if (contract.location.status !== "confirmed" || !contract.location.value?.trim()) return null;

  const parts = splitAlternatives(contract.location.value);
  if (parts.length === 0) return null;
  const byCanonicalName = new Map<string, string>();
  for (const city of cities) {
    for (const name of city.names) {
      byCanonicalName.set(canonicalizeForMatch(name).canonical, city.id);
    }
  }

  const ids: string[] = [];
  for (const part of parts) {
    const id = byCanonicalName.get(canonicalizeForMatch(part).canonical);
    // Every OR component must map exactly; never guess what "nearby" means.
    if (!id) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.length === parts.length ? ids : null;
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
    const hardCombinations = combinations(hardSlots.map((slot) => slot.values));

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

      for (const hardSlotValues of hardCombinations) {
        if (hardSlotValues.length === 0) continue;
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
