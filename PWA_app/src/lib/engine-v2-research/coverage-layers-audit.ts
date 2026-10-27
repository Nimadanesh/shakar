/**
 * Mechanical audit for the frozen Stage 2 hunt corpus.
 *
 * Layer 1: every structured source phrase must occur byte-for-byte in the
 * original hunt definition. No canonicalization is permitted for this check.
 * Layer 2: every content token in the definition after C1-C8 (never C9) must
 * occur in a source phrase belonging to the same hunt. The stopword list is
 * deliberately frozen and contains function words / markers only.
 *
 * This module audits data; it does not infer or repair contract semantics.
 */
import { canonicalizeForMatch } from "./persian-canonicalize";
import type { IntentContract } from "./intent-contract";

export const FROZEN_COVERAGE_STOPWORDS = new Set([
  "ترجیحاً",
  "نه",
  "و",
  "یا",
  "با",
  "در",
  "به",
  "از",
  "برای",
  "مثل",
  "به‌صورت",
  "بصورت",
]);

// Status/condition words are descriptive metadata. They must be represented in
// an informational condition slot with a verbatim source phrase, not as a
// rejection criterion. Keep this list explicit for reviewability.
export const STATUS_INFORMATION_TOKENS = new Set([
  "سالم", "نو", "کارکرده", "دست‌دوم", "دست دوم", "در حد نو",
  "خراب", "معیوب", "نیازمند تعمیر", "واکسینه", "اصیل",
]);

export interface FrozenHuntDefinition {
  readonly huntId: string;
  readonly query: string;
}

export interface CoverageIssue {
  readonly huntId: string;
  readonly layer: "structure" | "L1" | "L2" | "status";
  readonly path: string;
  readonly phrase?: string;
  readonly token?: string;
  readonly message: string;
}

function sourcePhrases(contract: IntentContract): Array<{ path: string; phrase: string }> {
  const out: Array<{ path: string; phrase: string }> = [
    { path: "entity.sourcePhrase", phrase: contract.entity.sourcePhrase },
  ];
  contract.slots.forEach((slot, i) => out.push({
    path: `slots[${i}].sourcePhrase`,
    phrase: slot.sourcePhrase,
  }));
  if (contract.transactions.sourcePhrase) out.push({
    path: "transactions.sourcePhrase",
    phrase: contract.transactions.sourcePhrase,
  });
  if (contract.location.sourcePhrase) out.push({
    path: "location.sourcePhrase",
    phrase: contract.location.sourcePhrase,
  });
  if (contract.price.sourcePhrase) out.push({
    path: "price.sourcePhrase",
    phrase: contract.price.sourcePhrase,
  });
  return out;
}

function c1ToC8Tokens(text: string): string[] {
  // Compare only C1-C8: C9a exists in the canonicalizer but is inert here because no corpus token set is supplied.
  return canonicalizeForMatch(text).tokens.filter(Boolean);
}

export function auditCoverageLayers(
  hunts: readonly FrozenHuntDefinition[],
  contracts: readonly IntentContract[],
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const huntById = new Map(hunts.map((hunt) => [hunt.huntId, hunt]));
  const contractById = new Map(contracts.map((contract) => [contract.huntId, contract]));

  for (const hunt of hunts) {
    const contract = contractById.get(hunt.huntId);
    if (!contract) {
      issues.push({ huntId: hunt.huntId, layer: "structure", path: "contract", message: "missing contract for frozen hunt" });
      continue;
    }
    const phrases = sourcePhrases(contract);
    for (const { path, phrase } of phrases) {
      if (!phrase || !hunt.query.includes(phrase)) {
        issues.push({
          huntId: hunt.huntId, layer: "L1", path, phrase,
          message: "source phrase is not an exact byte-for-byte substring of the frozen definition",
        });
      }
    }

    const coveredTokens = new Set(phrases.flatMap(({ phrase }) => c1ToC8Tokens(phrase)));
    const definitionTokens = c1ToC8Tokens(hunt.query);
    for (const token of definitionTokens) {
      if (FROZEN_COVERAGE_STOPWORDS.has(token)) continue;
      if (!coveredTokens.has(token)) {
        issues.push({
          huntId: hunt.huntId, layer: "L2", path: "definition",
          token, message: "content token has no source phrase in the same hunt",
        });
      }
    }

    // Status tokens that occur in the hunt must be carried by a condition slot
    // with a source phrase. They may never be represented as rejection slots.
    const conditionSlots = contract.slots.filter((slot) => slot.kind === "condition");
    for (const statusToken of STATUS_INFORMATION_TOKENS) {
      if (!c1ToC8Tokens(hunt.query).includes(statusToken)) continue;
      const represented = conditionSlots.some((slot) =>
        slot.sourcePhrase.length > 0 &&
        c1ToC8Tokens(slot.sourcePhrase).includes(statusToken) &&
        slot.polarity === "must" &&
        slot.kind === "condition" &&
        !slotMayRejectSafe(slot),
      );
      if (!represented) {
        issues.push({
          huntId: hunt.huntId, layer: "status", path: "slots",
          token: statusToken,
          message: "status token must be represented in a sourced informational condition slot",
        });
      }
    }
  }

  for (const contract of contracts) {
    if (!huntById.has(contract.huntId)) {
      issues.push({ huntId: contract.huntId, layer: "structure", path: "huntId", message: "contract has no matching frozen hunt" });
    }
  }
  return issues;
}

function slotMayRejectSafe(slot: IntentContract["slots"][number]): boolean {
  return slot.status === "confirmed" && slot.hardness === "hard" && slot.kind.trim().toLowerCase() !== "condition";
}

export interface C9Collision {
  readonly canonical: string;
  readonly originals: readonly string[];
  readonly suffixClass: "C9a" | "C9b" | "mixed";
}

export function auditC9bCollisions(
  collisions: readonly C9Collision[],
): C9Collision[] {
  return collisions.filter((collision) => collision.suffixClass === "C9b" || collision.suffixClass === "mixed");
}

/** C9a collisions among entity phrases from the 70 frozen contracts. */
export function auditC9aEntityCollisions(
  contracts: readonly IntentContract[],
  findC9FoldCollisions: (words: readonly string[]) => readonly C9Collision[],
): C9Collision[] {
  const entityPhrases = contracts.flatMap((contract) => [...contract.entity.values]);
  return findC9FoldCollisions(entityPhrases).filter(
    (collision) => collision.suffixClass === "C9a" || collision.suffixClass === "mixed",
  );
}
