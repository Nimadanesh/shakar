import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

type RoleCue = "mixed" | "buyer" | "seller" | "other";
type Cell = "seller" | "buyer" | "mixed" | "ordinary-appliance" | "wrong-kind-control" | "voucher" | "whole-vehicle" | "cash" | "installment" | "exchange";

function roleCue(title: string): RoleCue {
  const text = normalizeForMatch(title);
  const buyer = /خریدار|خریدارم|خریداریم|خرید|می\s?خرم|می\s?خوام|می\s?خواهم/.test(text);
  const seller = /فروش|فروشی|فروشنده|به\s?فروش/.test(text);
  if (buyer && seller) return "mixed";
  if (buyer) return "buyer";
  if (seller) return "seller";
  return "other";
}

function selectionCell(scenarioId: string, title: string): Cell | null {
  const text = normalizeForMatch(title);
  const adjacent = /دفتر|حواله|کارشناسی|مشاوره|خدمات|تعمیر|لوازم|ضبط|باند|قطعه|قطعات|مکانیک|واسطه|نمایندگی|کاتالیزور|اگزوز|باتری|لاستیک|رینگ|کفی|گیربکس|چراغ|آینه|سپر|کمک|جک|موتور/.test(text);
  const model = /(پژو|پراید|سمند|دنا|تیبا|کوییک|ساینا|تارا|شاهین|پارس|رانا|تندر|سورن|۲۰۶|206|۲۰۷|207|۴۰۵|405|ال\s?۹۰|ال\s?90|l90|زانتیا|ام\s?وی\s?ام|چری|جک\s?s|هایما|فیدلیتی|دیگنیتی|آریزو|اطلس|نیسان|تویوتا|هیوندای|کیا|بنز|بی\s?ام\s?و|مزدا|ری\s?را)/.test(text);
  const wholeVehicle = !adjacent && model;

  if (scenarioId.startsWith("A-refrigerator-")) {
    // Paired kind controls: ordinary target appliance vs. a part-only listing.
    const applianceTarget = /یخچال|فریزر|ساید/.test(text);
    const partsOnly = /موتور|کمپرسور|قطعه|قطعات/.test(text) &&
      !/یخچال\s?فریزر|فریزر\s?یخچال|ساید\s?بای\s?ساید|یخچال\s?ساید/.test(text);
    if (scenarioId === "A-refrigerator-wrong-kind") {
      return applianceTarget && partsOnly ? "wrong-kind-control" : null;
    }
    if (!applianceTarget || partsOnly) return null;
    if (scenarioId === "A-refrigerator-ordinary") return "ordinary-appliance";
    const cue = roleCue(title);
    return cue === "seller" || cue === "buyer" || cue === "mixed" ? cue : null;
  }
  if (scenarioId.startsWith("B-vehicle-")) {
    if (/حواله|دفتر/.test(text)) return "voucher";
    if (wholeVehicle && /فروش|فروشی|معاوضه|فوری|نقد|اقساط/.test(text)) return "whole-vehicle";
    return null;
  }
  if (scenarioId.startsWith("C-vehicle-")) {
    if (!wholeVehicle) return null;
    if (/اقساطی?|قسط|پیش\s?قسط|چک\s?صیادی/.test(text)) return "installment";
    if (/معاوضه|تهاتر|بدل/.test(text)) return "exchange";
    // Do not infer cash terms from "immediate delivery" or settlement-after-inspection.
    if (/نقدی|پرداخت\s?نقد|فروش\s?نقد/.test(text) && !/اقساط|قسط/.test(text)) return "cash";
    return null;
  }
  return null;
}

type Scenario = {
  id: string;
  query: string;
  category: string;
  cells: Cell[];
};

it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures independent Issue 16 Follow-up 03 evidence within fixed budgets",
  async () => {
    // 5 appliance role/kind controls + 2 vehicle-kind controls + 3 transaction-kind controls; strict total remains 8 details.
    // Each targeted query is capped at two list pages; missing cells stay missing.
    const scenarios: Scenario[] = [
      // Reserve the eight-detail budget for the role and transaction cells with the highest current evidence gaps.
      { id: "A-refrigerator-seller", query: "فروش یخچال", category: "home", cells: ["seller"] },
      { id: "A-refrigerator-buyer", query: "خریدار یخچال خراب", category: "home", cells: ["buyer"] },
      { id: "A-refrigerator-mixed", query: "خرید و فروش یخچال", category: "home", cells: ["mixed"] },
      // Keep whole-vehicle and voucher/service controls independently targeted.
      { id: "B-vehicle-whole", query: "خریدوفروش خودرو", category: "vehicles", cells: ["whole-vehicle"] },
      { id: "B-vehicle-voucher", query: "حواله خودرو", category: "vehicles", cells: ["voucher"] },
      // Transaction type has its own query, while the selector still requires explicit title evidence.
      { id: "C-vehicle-cash", query: "خودرو نقدی", category: "vehicles", cells: ["cash"] },
      { id: "C-vehicle-installment", query: "فروش اقساطی خودرو", category: "vehicles", cells: ["installment"] },
      // Narrow to a vehicle model + explicit exchange cue after the generic query missed this cell.
      { id: "C-vehicle-exchange", query: "معاوضه با سمند", category: "vehicles", cells: ["exchange"] },
      // Lower-priority paired kind controls remain in the scenario matrix but may be missing under the fixed global cap.
      { id: "A-refrigerator-ordinary", query: "یخچال", category: "home", cells: ["ordinary-appliance"] },
      { id: "A-refrigerator-wrong-kind", query: "قطعه یخچال", category: "home", cells: ["wrong-kind-control"] },
    ];
    const priorPacketIds = new Set([
      "gab_aV8W", "gaLNJNwu", "ga4iPfzH", "gaPHaEfq", "gaRj-fI_", "gaqV1O58",
      "galu34HS", "gavSad4q", "Qa4_oh_e", "gabPa811", "gaIL7h0B",
      "gaYvJrs6", "wZcsAVgg", "gab7Jmnv", "gabLLuzd", "gaP28UXT",
      // Exclude every listing already opened during the 2026-10-24 diagnostic captures.
      "gac_yx5p", "ga9Nx1wE", "gaFLygmQ", "gab7c23g", "gac7yxi1",
      "gajmIwfW", "gaQjucWz", "QaPvpvjd", "gaVXpJTP", "gaWDC3Xz",
      "gaf4cqwp", "gaU-i7iQ", "gac3hpjw", "gaAnK9CM", "gaA_eiS8",
      // Exclude every listing inspected in the reordered 2026-10-24 capture artifacts.
      "gaQ7okv9", "gaNhm4BK", "ga1M_D8i", "gac7D9Tv", "gaMPHkWW",
      "gaanVfX4", "gacLUYlL", "gaaPW6zt", "Aa5suyBE", "gajmIwfW",
      "gacjTTyh", "gayVhzOr", "gaSLpCEY",
      // Exclude all newly inspected IDs from the retargeted 2026-10-24 captures.
      "gavBLU60", "gaVn-dm2", "gabvBEiY", "ga7dAoCa", "gaKufbEV", "gabP-8po",
      "gaVP5Rtf", "gaXTjbv8", "gaTI-Kn3", "Qa8HqiWJ",
      // IDs inspected in the retargeted-v2 captures (commit 49a564a).
      "gac7TJRT", "gabzLV7f", "QaoPqC7X", "gaO7GNJh", "gaE5qO5h",
      "gabjtdOw", "gaay7dtd", "gaDkHop1", "gayyxUTa", "gaMPHkWW",
      "gajmIwfW", "gacjTTyh", "gaSLpCEY",
      // IDs opened by the cross-category exclusion-validation run.
      "gaZ6xXmW", "gaIL7h0B", "gaaLQFAi", "gabztl8G", "gaUrFcFK", "gaJaHd6y",
      // Previously graded IDs from the fresh paired and cross-cell blind packets.
      "gab_ekWg", "Qa9fP53U", "gaKTlAwq", "gaaPW6zt", "gabvBEiY", "ga726UUL",
      "gacXDBWE", "gacbznRe", "wZ-6rn1v", "gacTj43d",
      // IDs inspected in the exclusion-validation captures (including parallel run overlap).
      "gacT0u2G", "garWfS78", "gaVv8W6C", "gacXDBWE", "gaFzv-Qd",
      "gahEL1JU", "gaLHWNrk", "galqJmNl", "ga4d_A6Z", "gaPfmFQa", "gaUP4Rl-", "ga9KvfNV",
      // Newly opened in cross-category exclusion-verification run 40067592333.
      "gacXU-Wj", "gaoyGo-V", "gaRS8JbI", "gacfDsAU", "gabf9GoW", "gaBO62kC", "gaczD8Wv", "gaaOqkhk", "galGk_Sk", "gab_pT7w", "gaYrXwID", "gaYX7iQb", "gaPs0wws", "gacbUjPx", "gakSO3cA", "gaFbXSvI", "gaZTNpHg", "QaYHrsIF", "gaZDO_b2",
      // Newly opened in Follow-up 03 exclusion-verification run 40067592331.
      "gaGTm9S0", "gaHJo2YL", "gayyiAZb", "gaCPUsY9", "gabPbqO1", "gaKHDJrP", "gabzNkqG",
          // Selected IDs from the verified retargeted capture 03 blind packet; never reuse in later captures.
      "gacj0uNF",
      "QaRyXg2a",
      "gaZX_Yj3",
      "gaHbT4ov",
      "gaTbR5Rb",
      "gaBPPjUm",
      "Qa0L6SxA",
      "gaU2U0Mv",
      "gaqu1hx_",
      "gaEWi1OQ",
      "gacjUsaz",
      "gaPj2RbK",
      // IDs selected by fresh diagnostic captures on 2026-10-24; keep excluded from future packets.
      "ga6CSfMM",
      "gaNc5fRN",
      "gaH0zc7w",
      "gaFHdnop",
      "gabvI8Fm",
      "gacrEnA2",
      "gaeWepTl",
      "gaUnfe_p",
      "gaE75Gsi",
      "gaNDASAL",
      "gaJ_sXNx",
      "gaaTQEb7",
]);
    const reportPath = join(process.cwd(), "engine-v3-issue16-followup-03-capture.json");
    const previousBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    const previousDetailCap = process.env.HUNT_MAX_DETAILS;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(
      process.env.RUNNER_TEMP ?? process.cwd(),
      "engine-v3-issue16-followup-03-slugs.jsonl"
    );

    const globallySeen = new Set<string>();
    const reports: Array<Record<string, unknown>> = [];
    let detailsUsed = 0;
    const overlapWithPriorPackets = new Set<string>();

    try {
      for (const scenario of scenarios) {
        const budget = Math.min(scenario.cells.length, 8 - detailsUsed);
        if (budget <= 0) {
          reports.push({ id: scenario.id, query: scenario.query, status: "budget-exhausted", missingCells: scenario.cells });
          continue;
        }

        const def = resolveHuntDefinition({
          query: scenario.query,
          include: [],
          exclude: [],
          should: [],
          city: "all",
          category: scenario.category,
          priceMin: "",
          priceMax: "",
          transaction: "",
          condition: "",
        });
        expect(def, `definition must resolve for ${scenario.query}`).not.toBeNull();
        if (!def) {
          reports.push({ id: scenario.id, query: scenario.query, status: "definition-unresolved", missingCells: scenario.cells });
          continue;
        }

        const events: HuntEvent[] = [];
        const { candidates, stats, endCursor } = await collectCandidates(def, {
          maxPages: 2,
          emit: (event) => events.push(event),
        });

        const unused = candidates.filter((candidate) => {
          if (globallySeen.has(candidate.sourceAdId)) return false;
          if (priorPacketIds.has(candidate.sourceAdId)) {
            overlapWithPriorPackets.add(candidate.sourceAdId);
            return false;
          }
          return true;
        });

        const selected: typeof candidates = [];
        const selectedCells: Array<{ cell: Cell; sourceAdId: string }> = [];
        const missingCells: Cell[] = [];
        for (const cell of scenario.cells) {
          const match = unused.find((candidate) =>
            selectionCell(scenario.id, candidate.title) === cell &&
            !selected.some((picked) => picked.sourceAdId === candidate.sourceAdId)
          );
          if (!match || selected.length >= budget) {
            missingCells.push(cell);
            continue;
          }
          selected.push(match);
          selectedCells.push({ cell, sourceAdId: match.sourceAdId });
        }
        selected.forEach((candidate) => globallySeen.add(candidate.sourceAdId));

        const candidatePool = selected.map((candidate) => ({
          sourceAdId: candidate.sourceAdId,
          title: candidate.title,
          city: candidate.city,
          price: candidate.price,
          titleRoleCue: roleCue(candidate.title),
          selectionCell: selectionCell(scenario.id, candidate.title),
        }));
        const scored = await confirmCandidates(selected, def, stats, () => {});
        detailsUsed += stats.detailsChecked;

        const rejectedById = new Map<string, (typeof stats.rejectedSample)[number]>(
          stats.rejectedSample.flatMap((item) =>
            item.sourceAdId ? [[item.sourceAdId, item] as const] : []
          )
        );
        const scoredById = new Map<string, { item: (typeof scored)[number]; sampleRank: number }>(
          scored.map((item, index) => [item.sourceAdId, { item, sampleRank: index + 1 }] as const)
        );

        const listings = candidatePool.map((candidate) => {
          const scoredEntry = scoredById.get(candidate.sourceAdId);
          const rejectedEntry = rejectedById.get(candidate.sourceAdId);
          const item = scoredEntry?.item;
          const description = item?.descAuditText ?? rejectedEntry?.descAuditText ?? "";
          return {
            sourceAdId: candidate.sourceAdId,
            query: scenario.query,
            scenario: scenario.id,
            requestedCategory: scenario.category,
            selectionCell: candidate.selectionCell,
            title: candidate.title,
            descriptionSnapshot: description,
            descriptionSnapshotAvailable: description.length > 0,
            city: candidate.city,
            price: candidate.price,
            titleRoleCue: candidate.titleRoleCue,
            roleMode: def.roleMode ?? null,
            eligible: Boolean(item),
            sampleRank: scoredEntry?.sampleRank ?? null,
            productionRank: null,
            matchKind: item?.matchKind ?? (rejectedEntry ? "rejected" : "unknown"),
            score: item?.score ?? null,
            evidence: item?.evidence ?? [],
            missingInfo: item?.missingInfo ?? [],
            detailUnknown: item?.detailUnknown ?? !description,
            rejectedKind: rejectedEntry?.kind ?? null,
          };
        });

        reports.push({
          id: scenario.id,
          query: scenario.query,
          requestedCategory: scenario.category,
          status: selected.length ? "captured" : "empty-within-budget",
          missingCells,
          selectedCells,
          resolved: {
            include: def.include,
            exclude: def.exclude,
            should: def.should,
            roleMode: def.roleMode ?? null,
            serviceIntent: def.serviceIntent ?? false,
            category: def.category,
            city: def.city,
          },
          retrieval: {
            maxPages: 2,
            pagesCompleted: events.filter((event) => event.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            candidatesAfterFilters: candidates.length,
            cursorReturned: endCursor !== undefined && endCursor !== null,
            detailBudget: budget,
            detailsChecked: stats.detailsChecked,
            candidatePool,
          },
          listings,
        });
      }
    } finally {
      if (previousBufferPath === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH;
      else process.env.SLUG_CAPTURE_BUFFER_PATH = previousBufferPath;
      if (previousDetailCap === undefined) delete process.env.HUNT_MAX_DETAILS;
      else process.env.HUNT_MAX_DETAILS = previousDetailCap;
    }

    expect(detailsUsed).toBeLessThanOrEqual(8);
    expect(globallySeen.size).toBeLessThanOrEqual(8);

    const report = {
      kind: "read-only-issue16-followup-03-capture",
      warning: "Raw bounded evidence only. Not a blinded packet, not human grades, and not a production-rank comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxPagesPerQuery: 2,
        maxDetailsTotal: 8,
        maxDetailsUsed: detailsUsed,
        uniqueListingIds: globallySeen.size,
        scenarios: scenarios.length,
        scenarioCells: scenarios.map(({ id, cells }) => ({ id, cells })),
        missingCells: reports.flatMap((scenario) =>
          Array.isArray(scenario.missingCells)
            ? scenario.missingCells.map((cell) => ({ scenario: scenario.id, cell }))
            : []
        ),
        overlapWithPriorPackets: [...overlapWithPriorPackets],
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_ISSUE16_FOLLOWUP_03_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_ISSUE16_FOLLOWUP_03_JSON_END");
  },
  180_000
);
