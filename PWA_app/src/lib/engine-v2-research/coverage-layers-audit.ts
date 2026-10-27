import type { IntentContract } from "./intent-contract";
import { canonicalizeForMatch, findC9FoldCollisions } from "./persian-canonicalize";

export interface FrozenDefinition {
  readonly huntId: string;
  readonly query: string;
}
export interface CoverageIssue {
  readonly layer: "structure" | "layer1" | "layer2" | "status" | "c9a";
  readonly huntId: string;
  readonly detail: string;
}

/**
 * Frozen stopwords are grammatical/function words and explicit preference/negation
 * markers only. Content words, numbers, dimensions, brands and status values must
 * never be added here without architect approval.
 */
export const FROZEN_COVERAGE_STOPWORDS = [
  "ترجیحاً", "نه", "و", "یا", "با", "در", "به", "از", "برای", "فقط",
  "تا", "مثل", "بالای", "حداقل", "یا", "به‌صورت", "بصورت",
] as const;

const STATUS_WORDS = ["سالم", "نو", "کارکرده", "بیمار", "واکسینه", "شاداب"] as const;

function tokensC1toC8(text: string): string[] {
  // An empty corpus disables C9a while retaining precisely the C1-C8 token form.
  return canonicalizeForMatch(text).tokens as string[];
}

const STOPWORD_SET = new Set(FROZEN_COVERAGE_STOPWORDS.flatMap(tokensC1toC8));

export function auditCoverageLayers(
  frozen: readonly FrozenDefinition[],
  contracts: readonly IntentContract[],
  expectedHuntCount = 70,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  if (frozen.length !== expectedHuntCount) {
    issues.push({ layer: "structure", huntId: "*", detail: `expected ${expectedHuntCount} definitions, got ${frozen.length}` });
  }
  const frozenIds = new Set<string>();
  for (const item of frozen) {
    if (frozenIds.has(item.huntId)) issues.push({ layer: "structure", huntId: item.huntId, detail: "duplicate frozen hunt ID" });
    frozenIds.add(item.huntId);
  }
  const contractIds = new Set<string>();
  for (const contract of contracts) {
    if (contractIds.has(contract.huntId)) issues.push({ layer: "structure", huntId: contract.huntId, detail: "duplicate contract ID" });
    contractIds.add(contract.huntId);
  }
  for (const id of frozenIds) if (!contractIds.has(id)) issues.push({ layer: "structure", huntId: id, detail: "missing contract" });
  for (const id of contractIds) if (!frozenIds.has(id)) issues.push({ layer: "structure", huntId: id, detail: "unexpected contract" });

  for (const definition of frozen) {
    const contract = contracts.find((item) => item.huntId === definition.huntId);
    if (!contract) continue;
    const sources = [
      contract.entity.sourcePhrase,
      ...contract.slots.map((slot) => slot.sourcePhrase),
      contract.transactions.sourcePhrase,
      contract.location.sourcePhrase,
      contract.price.sourcePhrase,
    ].filter((phrase): phrase is string => phrase !== null && phrase.length > 0);

    // Layer 1: byte-for-byte JavaScript substring equality, with no normalization.
    for (const phrase of sources) {
      if (!definition.query.includes(phrase)) {
        issues.push({ layer: "layer1", huntId: definition.huntId, detail: `source phrase is not an exact substring: «${phrase}»` });
      }
    }

    // Layer 2: each content token from C1-C8 must be represented in a source phrase.
    const contentTokens = new Set(tokensC1toC8(definition.query));
    const coveredTokens = new Set(sources.flatMap(tokensC1toC8));
    for (const token of contentTokens) {
      if (STOPWORD_SET.has(token)) continue;
      if (!coveredTokens.has(token)) {
        issues.push({ layer: "layer2", huntId: definition.huntId, detail: `content token has no source coverage: «${token}»` });
      }
    }

    // Status is informational, never a rejection gate, but its source must be explicit.
    for (const statusWord of STATUS_WORDS) {
      if (!tokensC1toC8(definition.query).includes(statusWord)) continue;
      const statusSlot = contract.slots.find((slot) =>
        slot.kind === "condition" && slot.sourcePhrase.includes(statusWord));
      if (!statusSlot) {
        issues.push({ layer: "status", huntId: definition.huntId, detail: `status word «${statusWord}» lacks a condition slot with source phrase` });
      } else if (statusSlot.hardness === "hard") {
        issues.push({ layer: "status", huntId: definition.huntId, detail: `status slot «${statusWord}» must never be hard/rejecting` });
      }
    }
  }
  return issues;
}

/** C9b collision report stays audit-only; callers must gate only on this class. */
export function auditC9bCollisions(words: readonly string[]) {
  return findC9FoldCollisions(words).filter((collision) => collision.suffixClass === "C9b" || collision.suffixClass === "mixed");
}

/** C9a folding is checked against distinct commodity/entity phrases across the frozen corpus. */
export function auditC9aEntityCollisions(
  contracts: readonly IntentContract[],
  corpusTokens: ReadonlySet<string>,
): Array<{ canonical: string; originals: string[] }> {
  const byCanonical = new Map<string, Set<string>>();
  for (const contract of contracts) {
    if (contract.entity.kind !== "commodity") continue;
    for (const value of contract.entity.values) {
      const canonical = canonicalizeForMatch(value, { corpusTokens }).canonical;
      const values = byCanonical.get(canonical) ?? new Set<string>();
      values.add(value);
      byCanonical.set(canonical, values);
    }
  }
  return [...byCanonical.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([canonical, values]) => ({ canonical, originals: [...values].sort() }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical, "fa"));
}
