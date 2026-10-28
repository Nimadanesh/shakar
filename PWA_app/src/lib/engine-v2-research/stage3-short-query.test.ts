import { describe, expect, it } from "vitest";
import approvedContracts from "./data/draft-contracts-70.json";
import frozenCityMap from "./divar-cities.json";
import type { IntentContract } from "./intent-contract";
import { deriveStage3QueryPlan } from "./stage3-query-plan";

const contracts = approvedContracts.contracts as IntentContract[];

describe("Stage 3 Pass A service-core short queries", () => {
  const plan = deriveStage3QueryPlan(contracts, frozenCityMap.cities);
  const shortEntries = plan.entries.filter((entry) => entry.kind === "short");

  it("adds the confirmed source phrase for H06 and H07 where canonical tokens overlap", () => {
    expect(shortEntries.find((entry) => entry.huntId === "H06")).toMatchObject({
      kind: "short",
      query: "لوله‌بازکنی",
      status: "queued",
      sourceField: "transactions.sourcePhrase",
      decision: "emitted",
      reason: "ready",
    });
    expect(shortEntries.find((entry) => entry.huntId === "H07" && entry.entityAlternativeIndex === 0)).toMatchObject({
      kind: "short",
      query: "قالی‌شویی",
      status: "queued",
      sourceField: "transactions.sourcePhrase",
      decision: "emitted",
      reason: "ready",
    });
    expect(shortEntries.find((entry) => entry.huntId === "H07" && entry.entityAlternativeIndex === 1)).toMatchObject({
      kind: "short",
      query: "قالی‌شویی",
      status: "skipped-ineligible",
      sourceField: "transactions.sourcePhrase",
      decision: "skipped-no-canonical-overlap",
      reason: "short-no-canonical-overlap",
    });
  });

  it("only proposes Pass A for service entities and logs each source decision", () => {
    expect(shortEntries.length).toBeGreaterThan(0);
    expect(shortEntries.every((entry) =>
      entry.sourceField === "transactions.sourcePhrase" &&
      typeof entry.decision === "string"
    )).toBe(true);
    expect(plan.entries.some((entry) => entry.huntId === "H03" && entry.kind === "short")).toBe(false);
  });

  it("appends each short-query decision after that alternative's existing base/narrow decisions", () => {
    for (const short of shortEntries) {
      const prior = plan.entries.filter((entry) =>
        entry.huntId === short.huntId &&
        entry.entityAlternativeIndex === short.entityAlternativeIndex &&
        entry.kind !== "short"
      );
      expect(prior.every((entry) => entry.order < short.order)).toBe(true);
      expect(prior.some((entry) => entry.kind === "base")).toBe(true);
    }
    const h06Existing = plan.entries.filter((entry) => entry.huntId === "H06" && entry.kind !== "short");
    expect(h06Existing.map((entry) => entry.query)).toEqual([
      "لوله‌بازکنی فوری در محل",
      "لوله‌بازکنی فوری در محل",
    ]);
  });

  it("keeps existing base/narrow counts stable and reports the added total separately", () => {
    expect(plan.summary.baseQueries).toBe(137);
    expect(plan.summary.narrowQueries).toBe(28);
    expect(plan.summary.emittedQueries).toBe(165);
    expect(plan.summary.shortQueries).toBe(shortEntries.filter((entry) => entry.status === "queued").length);
    expect(plan.summary.totalEmittedQueries).toBe(165 + plan.summary.shortQueries!);
  });

  it("does not emit when the service source is unconfirmed or duplicates the base query", () => {
    const h06 = contracts.find((contract) => contract.huntId === "H06")!;
    const unconfirmed: IntentContract = {
      ...h06,
      huntId: "SYNTHETIC-UNCONFIRMED-SOURCE",
      transactions: { ...h06.transactions, status: "unknown" },
    };
    const duplicate: IntentContract = {
      ...h06,
      huntId: "SYNTHETIC-SHORT-DUPLICATE",
      entity: { ...h06.entity, values: ["لوله‌بازکنی"] },
    };

    const result = deriveStage3QueryPlan([unconfirmed, duplicate], frozenCityMap.cities);
    expect(result.entries.find((entry) => entry.huntId === unconfirmed.huntId && entry.kind === "short")).toMatchObject({
      status: "skipped-ineligible",
      decision: "skipped-source-unconfirmed",
      reason: "short-source-unconfirmed",
    });
    expect(result.entries.find((entry) => entry.huntId === duplicate.huntId && entry.kind === "short")).toMatchObject({
      status: "skipped-ineligible",
      decision: "skipped-duplicate",
      reason: "short-duplicate",
    });
    expect(result.summary.shortQueries).toBe(0);
  });
});
