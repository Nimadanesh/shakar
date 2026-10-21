import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates } from "./pipeline";

/**
 * One-query, read-only diagnostic of the production detail-budget allocation.
 *
 * It fetches details for the union of two 100-candidate allocations:
 *   A: top 100 by the current titleStrength ordering
 *   B: top 80 + 20 evenly spaced candidates from title ranks 101–200
 *
 * Total experimental detail fetches are capped at 120. Each counterfactual
 * allocation is still evaluated at a budget of 100. Engine exact/near verdicts
 * are only internal proxies; this is not a human relevance metric.
 */
it.skipIf(process.env.LIVE_DETAIL_ALLOCATION !== "1")(
  "measures below-cap candidate coverage on one live Divar query",
  async () => {
    const outputPath = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-detail-allocation.json"
    );
    const report: Record<string, unknown> = {
      kind: "read-only-detail-allocation-experiment",
      status: "running",
      warning:
        "Exact/near are engine verdicts, not human relevance labels. This is one live query and not a population estimate.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      query: "ماشین بدون رنگ",
      allocation: {
        pagesRequested: 20,
        productionDetailBudget: 100,
        experimentalUnionDetailBudget: 120,
        baseline: "top 100 by titleStrength",
        alternative: "top 80 by titleStrength + 20 evenly spaced ranks 101–200",
      },
    };

    try {
      const def = resolveHuntDefinition({ query: "ماشین بدون رنگ" });
      expect(def, "query definition must resolve").not.toBeNull();
      if (!def) throw new Error("Could not resolve query definition");

      const events: Array<{ type: string; [key: string]: unknown }> = [];
      const { candidates, stats, endCursor } = await collectCandidates(def, {
        maxPages: 20,
        emit: (event) => events.push(event as unknown as { type: string; [key: string]: unknown }),
      });

      // Mirror confirmCandidates' actual stable sort exactly.
      const ranked = [...candidates].sort((a, b) => b.titleStrength - a.titleStrength);
      const rankById = new Map(ranked.map((candidate, index) => [candidate.sourceAdId, index + 1]));
      const baselineCandidates = ranked.slice(0, 100);
      const tail = ranked.slice(100, 200);
      const sampleSize = Math.min(20, tail.length);
      const explorationCandidates =
        sampleSize === 0
          ? []
          : Array.from({ length: sampleSize }, (_, i) =>
              tail[Math.min(tail.length - 1, Math.floor(((i + 0.5) * tail.length) / sampleSize))]
            );
      const baselineIds = new Set(baselineCandidates.map((candidate) => candidate.sourceAdId));
      const alternativeCandidates = [
        ...ranked.slice(0, 80),
        ...explorationCandidates,
      ];
      const alternativeIds = new Set(alternativeCandidates.map((candidate) => candidate.sourceAdId));
      const union = [
        ...baselineCandidates,
        ...explorationCandidates.filter((candidate) => !baselineIds.has(candidate.sourceAdId)),
      ];

      // Detail fetches are local/read-only. Slug capture is buffered in runner temp;
      // the workflow provides no Supabase credentials and Mizan is disabled.
      const results = await confirmCandidates(
        union,
        def,
        stats,
        (event) => events.push(event as unknown as { type: string; [key: string]: unknown })
      );
      const resultById = new Map(results.map((result) => [result.sourceAdId, result]));

      const summarizeArm = (name: string, ids: Set<string>) => {
        const armResults = results.filter((result) => ids.has(result.sourceAdId));
        return {
          name,
          candidateBudget: ids.size,
          exact: armResults.filter((result) => result.matchKind === "exact").length,
          near: armResults.filter((result) => result.matchKind === "near").length,
          notReturned: ids.size - armResults.length,
          top10: armResults.slice(0, 10).map((result, index) => ({
            rank: index + 1,
            titleRank: rankById.get(result.sourceAdId) ?? null,
            sourceAdId: result.sourceAdId,
            title: result.title,
            matchKind: result.matchKind,
            score: result.score,
            demotedBy: result.demotedBy ?? null,
            evidence: result.evidence,
            missingInfo: result.missingInfo,
            descriptionExcerpt: result.descSnippet,
          })),
        };
      };

      const explorationScored = explorationCandidates.map((candidate) => {
        const result = resultById.get(candidate.sourceAdId);
        return {
          titleRank: rankById.get(candidate.sourceAdId) ?? null,
          titleStrength: candidate.titleStrength,
          sourceAdId: candidate.sourceAdId,
          title: candidate.title,
          matchKind: result?.matchKind ?? "not-returned",
          score: result?.score ?? null,
          demotedBy: result?.demotedBy ?? null,
          evidence: result?.evidence ?? [],
          missingInfo: result?.missingInfo ?? [],
          descriptionExcerpt: result?.descSnippet ?? null,
        };
      });

      report.status = "completed";
      report.retrieval = {
        pagesRequested: 20,
        pagesCompleted: events.filter((event) => event.type === "lists-progress").length,
        adsSeen: stats.adsSeen,
        candidatesAfterFilters: candidates.length,
        duplicatesCollapsed: stats.dupsCollapsed,
        detailsChecked: stats.detailsChecked,
        stale: stats.stale,
        cursorReturned: endCursor !== undefined && endCursor !== null,
        titleStrengthAtRanks: [1, 80, 100, 101, 120, 150, 200, 500]
          .map((rank) => ({ rank, value: ranked[rank - 1]?.titleStrength ?? null, title: ranked[rank - 1]?.title ?? null }))
          .filter((item) => item.value !== null),
      };
      report.arms = {
        baseline: summarizeArm("top-100-title", baselineIds),
        alternative: summarizeArm("top-80-plus-20-exploration", alternativeIds),
      };
      report.explorationSample = explorationScored;
      report.caveat =
        "The union uses 120 detail fetches for diagnosis. Compare each arm as a 100-candidate allocation; internal exact/near counts are not human relevance labels.";
    } catch (error) {
      report.status = "failed";
      report.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
      console.log("ENGINE_V3_DETAIL_ALLOCATION_JSON_BEGIN");
      console.log(JSON.stringify(report, null, 2));
      console.log("ENGINE_V3_DETAIL_ALLOCATION_JSON_END");
      console.log(`Report written to ${outputPath}`);
    }
  },
  1_200_000
);
