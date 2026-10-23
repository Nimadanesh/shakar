import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { assessListingRole, assessQueryIntent } from "./semantics";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

/**
 * Read-only regression probe for role direction. Separate from the negative
 * repair-history observation so each experiment has an explicit detail budget.
 * This captures unjudged evidence; it does not score relevance or compare arms.
 */
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures bounded live seller-seeking and ordinary refrigerator role controls",
  async () => {
    const cases = [
      { id: "seek-seller-refrigerator", query: "فروشنده یخچال", detailBudget: 2 },
      { id: "ordinary-refrigerator-search", query: "یخچال", detailBudget: 2 },
    ] as const;
    const reports: Array<Record<string, unknown>> = [];
    const oldBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-role-regression-slugs.jsonl"
    );
    let detailsBudgetUsed = 0;
    try {
      for (const scenario of cases) {
        const remaining = 4 - detailsBudgetUsed;
        if (remaining <= 0) break;
        process.env.HUNT_MAX_DETAILS = String(Math.min(scenario.detailBudget, remaining));
        const def = resolveHuntDefinition({
          query: scenario.query,
          include: [],
          exclude: [],
          should: [],
          city: "all",
          category: "all",
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
        const roleHint = (title: string) =>
          /خریدار|خریداریم|خریدارم|می\s?خوام|می\s?خواهیم|فروش|فروشی|فروشنده/.test(title);
        const roleCandidates = candidates.filter((candidate) => roleHint(candidate.title));
        const detailCandidates =
          roleCandidates.length > 0
            ? [
                ...roleCandidates.slice(0, scenario.detailBudget),
                ...candidates
                  .filter((candidate) => !roleHint(candidate.title))
                  .slice(0, Math.max(0, scenario.detailBudget - roleCandidates.length)),
              ]
            : candidates.slice(0, scenario.detailBudget);
        const detailCandidatePool = detailCandidates.map((candidate) => ({
          sourceAdId: candidate.sourceAdId,
          title: candidate.title,
        }));
        const results = await confirmCandidates(
          detailCandidates,
          def,
          stats,
          (event) => events.push(event)
        );
        detailsBudgetUsed += stats.detailsChecked;

        reports.push({
          id: scenario.id,
          query: scenario.query,
          resolved: {
            include: def.include,
            exclude: def.exclude,
            should: def.should,
            roleMode: def.roleMode ?? null,
            serviceIntent: def.serviceIntent ?? false,
            absentAttributes: def.absentAttributes ?? [],
            category: def.category,
            city: def.city,
          },
          queryRole: assessQueryIntent(def.query, def.category, def.transaction),
          retrieval: {
            pagesRequested: 2,
            pagesCompleted: events.filter((event) => event.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            titleRejected: stats.titleRejected,
            duplicatesCollapsed: stats.dupsCollapsed,
            candidatesAfterFilters: candidates.length,
            roleHintCandidates: roleCandidates.length,
            detailSelection: roleCandidates.length > 0 ? "role-cue-prioritized" : "default-title-strength-order",
            detailsChecked: stats.detailsChecked,
            detailCandidatePool,
            confirmed: stats.confirmed,
            nearMiss: stats.nearMiss,
            rejectedNoMatch: stats.rejectedNoMatch,
            rejectedSample: stats.rejectedSample,
            stale: stats.stale,
            slugCapture: stats.slugCapture ?? null,
            cursorReturned: endCursor !== undefined && endCursor !== null,
          },
          topResults: results.slice(0, 8).map((result, index) => {
            const listingText = `${result.title} ${result.descAuditText ?? result.descSnippet ?? ""}`;
            return {
              rank: index + 1,
              sourceAdId: result.sourceAdId,
              title: result.title,
              price: result.price,
              city: result.city,
              matchKind: result.matchKind,
              score: result.score,
              evidence: result.evidence,
              missingInfo: result.missingInfo,
              detailUnknown: result.detailUnknown ?? false,
              demotedBy: result.demotedBy ?? null,
              descriptionExcerpt: result.descAuditText ?? result.descSnippet,
              listingRole: assessListingRole(listingText),
            };
          }),
        });
      }
    } finally {
      if (oldBufferPath === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH;
      else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBufferPath;
    }

    expect(detailsBudgetUsed).toBeLessThanOrEqual(4);
    const report = {
      kind: "read-only-live-role-regression-observation",
      warning: "Unjudged observations only; not a relevance score or a paired quality comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxListPagesPerQuery: 2,
        maxDetailsTotal: 4,
        maxDetailsUsed: detailsBudgetUsed,
        perScenarioDetailBudgets: cases.map(({ id, detailBudget }) => ({ id, detailBudget })),
        queries: cases.length,
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
    };
    const outputPath = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-role-regression-observation.json"
    );
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_ROLE_REGRESSION_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_ROLE_REGRESSION_JSON_END");
    console.log(`Report written to ${outputPath}`);
    expect(reports).toHaveLength(cases.length);
  },
  300_000
);
