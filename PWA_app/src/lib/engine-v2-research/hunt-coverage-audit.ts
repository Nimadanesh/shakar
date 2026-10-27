import type { IntentContract } from "./intent-contract";

export interface FrozenHuntExpectation {
  readonly huntId: string;
  readonly query: string;
  /** Exact source phrases of every hard slot in the frozen source contract. */
  readonly hardSlotSourcePhrases: readonly string[];
}

export interface HuntCoverageIssue {
  readonly huntId: string;
  readonly kind: "missing-contract" | "unexpected-contract" | "missing-hard-slot" | "duplicate-id" | "missing-source";
  readonly detail: string;
}

/**
 * Compare generated/serialized contracts with the independently frozen source
 * inventory. This function does not invent IDs or infer slots from free text.
 */
export function auditHuntCoverage(
  frozen: readonly FrozenHuntExpectation[],
  contracts: readonly IntentContract[],
  expectedHuntCount = 70,
): HuntCoverageIssue[] {
  const issues: HuntCoverageIssue[] = [];
  if (frozen.length !== expectedHuntCount) {
    issues.push({
      huntId: "*",
      kind: "missing-source",
      detail: `expected ${expectedHuntCount} frozen hunts, received ${frozen.length}`,
    });
  }

  const sourceCounts = new Map<string, number>();
  for (const item of frozen) {
    sourceCounts.set(item.huntId, (sourceCounts.get(item.huntId) ?? 0) + 1);
    if (!item.huntId.trim() || !item.query.trim()) {
      issues.push({ huntId: item.huntId || "*", kind: "missing-source", detail: "huntId and original query are required" });
    }
    if (sourceCounts.get(item.huntId) === 2) {
      issues.push({ huntId: item.huntId, kind: "duplicate-id", detail: "duplicate ID in frozen source inventory" });
    }
  }

  const contractCounts = new Map<string, number>();
  for (const contract of contracts) {
    contractCounts.set(contract.huntId, (contractCounts.get(contract.huntId) ?? 0) + 1);
    if (contractCounts.get(contract.huntId) === 2) {
      issues.push({ huntId: contract.huntId, kind: "duplicate-id", detail: "duplicate contract ID" });
    }
  }

  const sourceIds = new Set(frozen.map((item) => item.huntId));
  const contractIds = new Set(contracts.map((item) => item.huntId));
  for (const item of frozen) {
    if (!contractIds.has(item.huntId)) {
      issues.push({ huntId: item.huntId, kind: "missing-contract", detail: "no contract for frozen hunt" });
      continue;
    }
    const contract = contracts.find((candidate) => candidate.huntId === item.huntId);
    if (!contract) continue;
    const hardSources = new Set(
      contract.slots
        .filter((slot) => slot.hardness === "hard" && slot.status === "confirmed")
        .map((slot) => slot.sourcePhrase),
    );
    for (const sourcePhrase of item.hardSlotSourcePhrases) {
      if (!hardSources.has(sourcePhrase)) {
        issues.push({
          huntId: item.huntId,
          kind: "missing-hard-slot",
          detail: `hard slot source phrase lost or changed: «${sourcePhrase}»`,
        });
      }
    }
  }
  for (const contract of contracts) {
    if (!sourceIds.has(contract.huntId)) {
      issues.push({ huntId: contract.huntId, kind: "unexpected-contract", detail: "contract is not present in frozen source inventory" });
    }
  }
  return issues;
}
