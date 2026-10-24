import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

type RoleCue = "mixed" | "buyer" | "seller" | "other";

function roleCue(title: string): RoleCue {
  const text = normalizeForMatch(title);
  const buyer = /خریدار|خریدارم|خریداریم|می\s?خرم|می\s?خوام|می\s?خواهم/.test(text);
  const seller = /فروش|فروشی|فروشنده|به\s?فروش/.test(text);
  if (buyer && seller) return "mixed";
  if (buyer) return "buyer";
  if (seller) return "seller";
  return "other";
}

/**
 * Issue #16: bounded, read-only cross-category evidence capture.
 * The output is diagnostic only: no human grades, no production-rank claim,
 * no eligibility/ranking change, and no mutation of a live service.
 */
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures Issue 16 cross-category transaction-role evidence within fixed budgets",
  async () => {
    // Four distinct query scenarios, with a strict six-detail total budget.
    // Keep compact/spaced hybrid titles comparable and reserve two details for
    // the buyer-intent and spaced-title controls. Role cues are title-only;
    // descriptions are preserved for human review and must not be inferred.
    const scenarios = [
      {
        id: "refrigerator-reference",
        query: "فروشنده یخچال",
        category: "home",
        detailBudget: 1,
        desired: ["mixed", "seller", "buyer", "other"] as RoleCue[],
      },
      {
        id: "vehicle-buy-sell-compact",
        query: "خریدوفروش خودرو",
        category: "vehicles",
        detailBudget: 1,
        desired: ["mixed", "seller", "buyer", "other"] as RoleCue[],
      },
      {
        id: "vehicle-buyer-damaged-vehicle-control",
        query: "خریدار خودرو تصادفی",
        category: "vehicles",
        detailBudget: 2,
        desired: ["buyer", "seller", "mixed", "other"] as RoleCue[],
      },
      {
        id: "vehicle-buy-sell-spaced",
        query: "خرید و فروش خودرو",
        category: "vehicles",
        detailBudget: 2,
        desired: ["mixed", "seller", "buyer", "other"] as RoleCue[],
      },
    ] as const;

    const reportPath = join(process.cwd(), "engine-v3-issue16-cross-category-capture.json");
    const previousBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    const previousDetailCap = process.env.HUNT_MAX_DETAILS;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(
      process.env.RUNNER_TEMP ?? process.cwd(),
      "engine-v3-issue16-cross-category-slugs.jsonl"
    );

    const previouslyInspectedIds = new Set([
      // IDs already opened in earlier Issue 16 packets and diagnostic captures.
      "gab_aV8W", "gaLNJNwu", "ga4iPfzH", "gaPHaEfq", "gaRj-fI_", "gaqV1O58",
      "galu34HS", "gavSad4q", "Qa4_oh_e", "gabPa811", "gaIL7h0B",
      "gaYvJrs6", "wZcsAVgg", "gab7Jmnv", "gabLLuzd", "gaP28UXT",
      "gaZ6xXmW", "gaaLQFAi", "gabztl8G", "gaUrFcFK", "gaJaHd6y",
      "gac_yx5p", "ga9Nx1wE", "gaFLygmQ", "gab7c23g", "gac7yxi1",
      "gajmIwfW", "gaQjucWz", "QaPvpvjd", "gaVXpJTP", "gaWDC3Xz",
      "gaf4cqwp", "gaU-i7iQ", "gac3hpjw", "gaAnK9CM", "gaA_eiS8",
      "gaQ7okv9", "gaNhm4BK", "ga1M_D8i", "gac7D9Tv", "gaMPHkWW",
      "gaanVfX4", "gacLUYlL", "gaaPW6zt", "Aa5suyBE", "gacjTTyh",
      "gayVhzOr", "gaSLpCEY", "gavBLU60", "gaVn-dm2", "gabvBEiY",
      "ga7dAoCa", "gaKufbEV", "gabP-8po", "gaVP5Rtf", "gaXTjbv8",
      "gaTI-Kn3", "Qa8HqiWJ", "gac7TJRT", "gabzLV7f", "QaoPqC7X",
      "gaO7GNJh", "gaE5qO5h", "gabjtdOw", "gaay7dtd", "gaDkHop1",
      "gayyxUTa",
      // IDs opened by the exclusion-validation capture; never reuse for blind review.
      "gaZ6xXmW", "gaIL7h0B", "gaaLQFAi", "gabztl8G", "gaUrFcFK", "gaJaHd6y",
      // Previously graded IDs from the fresh paired and cross-cell blind packets.
      "gab_ekWg", "Qa9fP53U", "gaKTlAwq", "gaaPW6zt", "gabvBEiY", "ga726UUL",
      "gacXDBWE", "gacbznRe", "wZ-6rn1v", "gacTj43d",
      // IDs inspected in the exclusion-validation captures (including parallel run overlap). Any selected ID also listed in overlapWithInspected invalidates the capture as a stale/mismatched exclusion snapshot.
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
      // IDs from earlier bounded diagnostic captures; exclude across future packets.
      "QaM0ztoJ",
      "gaN3EAVR",
      "ga2qQAPq",
      "gallxRrN",
      "AZYprmyz",
      "gacdDbtu",
      "gabKdk6q",
      "gaYz4Oi-",
      "gaVrrHpB",
      "ga5OBB6n",
      "gac3D4fJ",
      "gaU7IS1j",
      "gaWHIDAt",
      "gacvUdQ_",
      "gabT47tX",
      "ga36JfvB",
      "gabnYS2G",
]);
    const overlapWithInspected = new Set<string>();
    const globallySeen = new Set<string>();
    const reports: Array<Record<string, unknown>> = [];
    let detailsUsed = 0;

    try {
      for (const scenario of scenarios) {
        const budget = Math.min(scenario.detailBudget, 6 - detailsUsed);
        if (budget <= 0) break;
        process.env.HUNT_MAX_DETAILS = String(budget);

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
        if (!def) continue;

        const events: HuntEvent[] = [];
        const { candidates, stats, endCursor } = await collectCandidates(def, {
          maxPages: 2,
          emit: (event) => events.push(event),
        });

        const unused = candidates.filter((candidate) => {
          if (globallySeen.has(candidate.sourceAdId)) return false;
          if (previouslyInspectedIds.has(candidate.sourceAdId)) {
            overlapWithInspected.add(candidate.sourceAdId);
            return false;
          }
          return true;
        });
        const selected: typeof candidates = [];
        for (const cue of scenario.desired) {
          const match = unused.find((candidate) =>
            roleCue(candidate.title) === cue &&
            !selected.some((picked) => picked.sourceAdId === candidate.sourceAdId)
          );
          if (match) selected.push(match);
          if (selected.length >= budget) break;
        }
        for (const candidate of unused) {
          if (selected.length >= budget) break;
          if (!selected.some((picked) => picked.sourceAdId === candidate.sourceAdId)) selected.push(candidate);
        }
        selected.forEach((candidate) => globallySeen.add(candidate.sourceAdId));

        const candidatePool = selected.map((candidate) => ({
          sourceAdId: candidate.sourceAdId,
          title: candidate.title,
          city: candidate.city,
          price: candidate.price,
          titleRoleCue: roleCue(candidate.title),
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

    const report = {
      kind: "read-only-issue16-cross-category-capture",
      warning: "Raw bounded evidence only. Not a blinded packet, not human grades, and not a production-rank comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxPagesPerQuery: 2,
        maxDetailsTotal: 6,
        maxDetailsUsed: detailsUsed,
        uniqueListingIds: globallySeen.size,
        scenarios: scenarios.length,
        scenarioDetailBudgets: scenarios.map(({ id, detailBudget }) => ({ id, detailBudget })),
        overlapWithInspected: [...overlapWithInspected],
        requestedCategories: ["home", "vehicles"],
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_ISSUE16_CROSS_CATEGORY_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_ISSUE16_CROSS_CATEGORY_JSON_END");
  }, 120_000);
