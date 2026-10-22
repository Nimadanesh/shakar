import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates } from "./pipeline";

/**
 * Read-only paired live diagnostic for two query families not used in E3:
 *   - whole item vs accessory ("کفی ماشین")
 *   - service vs goods ("تعمیر یخچال")
 *
 * Each arm gets a 100-candidate allocation. A 120-detail union allows both
 * counterfactuals to be evaluated on the same retrieved candidate pool.
 * Engine exact/near counts are proxies, not human relevance labels.
 */
it.skipIf(process.env.LIVE_DETAIL_ALLOCATION_MULTI !== "1")(
  "compares title-only and exploration allocations on two held-out live query families",
  async () => {
    const outputPath = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-detail-allocation-multi.json"
    );
    const queries = ["کفی ماشین", "تعمیر یخچال"];
    const report: Record<string, unknown> = {
      kind: "read-only-multi-query-detail-allocation-experiment",
      status: "running",
      warning:
        "Live retrieval is bounded. Exact/near are engine verdicts, not human labels. Two queries are diagnostic, not a population estimate.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      allocation: {
        pagesRequestedPerQuery: 20,
        productionDetailBudgetPerArm: 100,
        experimentalUnionDetailBudgetPerQuery: 120,
        baseline: "top 100 by titleStrength",
        alternative: "top 80 by titleStrength + 20 evenly spaced ranks 101–200",
      },
      queries: [],
    };

    const queryReports: Array<Record<string, unknown>> = [];
    try {
      for (const query of queries) {
        const def = resolveHuntDefinition({ query });
        expect(def, `query definition must resolve: ${query}`).not.toBeNull();
        if (!def) throw new Error(`Could not resolve query definition: ${query}`);

        const events: Array<{ type: string; [key: string]: unknown }> = [];
        const { candidates, stats, endCursor } = await collectCandidates(def, {
          maxPages: 20,
          emit: (event) =>
            events.push(event as unknown as { type: string; [key: string]: unknown }),
        });

        // Match production's stable title-strength ordering and preserve the
        // collector's fetch-order dedupe semantics.
        const ranked = [...candidates].sort(
          (a, b) => b.titleStrength - a.titleStrength
        );
        const rankById = new Map(
          ranked.map((candidate, index) => [candidate.sourceAdId, index + 1])
        );
        const baselineCandidates = ranked.slice(0, 100);
        const tail = ranked.slice(100, 200);
        const sampleSize = Math.min(20, tail.length);
        const explorationCandidates =
          sampleSize === 0
            ? []
            : Array.from({ length: sampleSize }, (_, i) =>
                tail[
                  Math.min(
                    tail.length - 1,
                    Math.floor(((i + 0.5) * tail.length) / sampleSize)
                  )
                ]
              );
        const baselineIds = new Set(
          baselineCandidates.map((candidate) => candidate.sourceAdId)
        );
        const alternativeCandidates = [
          ...ranked.slice(0, 80),
          ...explorationCandidates,
        ];
        const alternativeIds = new Set(
          alternativeCandidates.map((candidate) => candidate.sourceAdId)
        );
        const union = [
          ...baselineCandidates,
          ...explorationCandidates.filter(
            (candidate) => !baselineIds.has(candidate.sourceAdId)
          ),
        ];

        const results = await confirmCandidates(
          union,
          def,
          stats,
          (event) =>
            events.push(event as unknown as { type: string; [key: string]: unknown })
        );

        const summarizeArm = (name: string, ids: Set<string>) => {
          const armResults = results.filter((result) =>
            ids.has(result.sourceAdId)
          );
          return {
            name,
            candidateBudget: ids.size,
            exact: armResults.filter((result) => result.matchKind === "exact").length,
            near: armResults.filter((result) => result.matchKind === "near").length,
            rejectedOrNotReturned: ids.size - armResults.length,
            top20: armResults.slice(0, 20).map((result, index) => ({
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

        queryReports.push({
          query,
          retrieval: {
            pagesRequested: 20,
            pagesCompleted: events.filter(
              (event) => event.type === "lists-progress"
            ).length,
            adsSeen: stats.adsSeen,
            candidatesAfterFilters: candidates.length,
            duplicatesCollapsed: stats.dupsCollapsed,
            detailsChecked: stats.detailsChecked,
            stale: stats.stale,
            cursorReturned: endCursor !== undefined && endCursor !== null,
            titleStrengthAtRanks: [1, 80, 100, 101, 120, 150, 200]
              .map((rank) => ({
                rank,
                value: ranked[rank - 1]?.titleStrength ?? null,
                title: ranked[rank - 1]?.title ?? null,
              }))
              .filter((item) => item.value !== null),
          },
          arms: {
            baseline: summarizeArm("top-100-title", baselineIds),
            alternative: summarizeArm("top-80-plus-20-exploration", alternativeIds),
          },
          sampledTail: explorationCandidates.map((candidate) => ({
            titleRank: rankById.get(candidate.sourceAdId) ?? null,
            sourceAdId: candidate.sourceAdId,
            title: candidate.title,
            titleStrength: candidate.titleStrength,
          })),
        });
      }

      report.status = "completed";
      report.queries = queryReports;
      report.caveat =
        "Each arm is a 100-candidate counterfactual. The shared 120-detail union is diagnostic only. Human grading is required before any production allocation change.";
    } catch (error) {
      report.status = "failed";
      report.error = error instanceof Error ? error.message : String(error);
      report.queries = queryReports;
      throw error;
    } finally {
      await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
      console.log("ENGINE_V3_DETAIL_ALLOCATION_MULTI_JSON_BEGIN");
      console.log(JSON.stringify(report, null, 2));
      console.log("ENGINE_V3_DETAIL_ALLOCATION_MULTI_JSON_END");
      console.log(`Report written to ${outputPath}`);
    }
  },
  2_400_000
);
