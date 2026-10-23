import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { assessListingRole, assessQueryIntent } from "./semantics";
import {
  collectCandidates,
  confirmCandidates,
  type HuntEvent,
} from "./pipeline";

/**
 * Read-only live observation. Intentionally excluded from ordinary CI unless
 * LIVE_DIVAR_OBSERVATION=1 is explicitly set by the dedicated workflow.
 * No assertions are made about relevance: this captures evidence for review,
 * it does not turn unjudged live results into a quality score.
 */
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures a bounded live Divar observation for critical query families",
  async () => {
    // Explicit total budget: at most eight detail fetches across ALL scenarios.
    // Total budget: negated-history query gets three slots; positive exchange gets two;
    // exact-phrase query gets three. Do not interpret HUNT_MAX_DETAILS as global.
    const cases = [
      // Include the product plus the known replacement-history vocabulary so
      // list retrieval can surface likely real history-bearing ads. A title-cue
      // diagnostic then spends the small detail budget on likely candidates.
      { id: "negated-replacement-history", query: "پیانو قطعات اورجینال تعویض نشده", detailBudget: 3 },
      { id: "explicit-exchange-flatbed", query: "معاوضه با کفی سه محور", detailBudget: 2 },
      { id: "exact-negated-phrase", query: "تعمیر یا تعویض نشده است", detailBudget: 3 },
    ] as const;

    const reports: Array<Record<string, unknown>> = [];
    const oldBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-live-observation-slug-buffer.jsonl"
    );

    let detailsBudgetUsed = 0;
    try {
      for (const scenario of cases) {
        const remainingBudget = 8 - detailsBudgetUsed;
        if (remainingBudget <= 0) break;
        // confirmCandidates reads this per-hunt cap. Clamp each scenario to
        // its assigned share and the remaining experiment-wide budget.
        process.env.HUNT_MAX_DETAILS = String(Math.min(scenario.detailBudget, remainingBudget));
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
        // For the negated-history diagnostic only, spend the small detail
        // budget on titles likely to describe item condition/history. This is
        // deliberately a targeted probe, not a representative rank sample.
        const historyHint = (title: string) =>
          /تعویض|قطعات|اورجینال|اصلی|فابریک|فروشگاه|مرجع/.test(title);
        const historyCandidates = candidates.filter((candidate) => historyHint(candidate.title));
        const detailCandidates =
          scenario.id === "negated-replacement-history" && historyCandidates.length > 0
            ? [
                ...historyCandidates.slice(0, scenario.detailBudget),
                ...candidates
                  .filter((candidate) => !historyHint(candidate.title))
                  .slice(0, Math.max(0, scenario.detailBudget - historyCandidates.length)),
              ]
            : candidates;
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
            serviceIntent: def.serviceIntent ?? false,
            absentAttributes: def.absentAttributes ?? [],
            category: def.category,
            city: def.city,
          },
          queryRole: assessQueryIntent(def.query, def.category, def.transaction),
          retrieval: {
            pagesRequested: 2,
            pagesCompleted: events.filter((e) => e.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            titleRejected: stats.titleRejected,
            duplicatesCollapsed: stats.dupsCollapsed,
            candidatesAfterFilters: candidates.length,
            detailSelection:
              scenario.id === "negated-replacement-history"
                ? {
                    method: "title-cue-prioritized-diagnostic",
                    historyHintCandidates: historyCandidates.length,
                  }
                : { method: "default-title-strength-order" },
            detailsChecked: stats.detailsChecked,
            confirmed: stats.confirmed,
            nearMiss: stats.nearMiss,
            rejectedNoMatch: stats.rejectedNoMatch,
            stale: stats.stale,
            slugCapture: stats.slugCapture ?? null,
            cursorReturned: endCursor !== undefined && endCursor !== null,
          },
          topResults: results.slice(0, 8).map((result, index) => {
            const listingText = `${result.title} ${result.descAuditText ?? result.descSnippet ?? ""}`;
            const listingRole = assessListingRole(listingText);
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
              listingRole,
              exchangeCueAudit: {
                hasNegatedReplacementHistory:
                  /(?:قطعات?\s+)?تعویض\s+(?:نشده(?:\s+است)?|نشد(?:ه)?(?:\s+است)?|ندارد|نداشته(?:\s+است)?|نمی\s?شود|نمی\s?باشد)|(?:بدون|فاقد)\s+تعویض/.test(listingText),
                hasPositiveExchangeCue: /معاوضه|با کالای دیگر تعویض می‌کنم/.test(listingText),
              },
            };
          }),
        });
      }
    } finally {
      if (oldBufferPath === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH;
      else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBufferPath;
    }

    expect(detailsBudgetUsed).toBeLessThanOrEqual(8);

    const report = {
      kind: "read-only-live-observation",
      warning: "Unjudged observations only; not a relevance score or a paired quality comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxListPagesPerQuery: 2,
        maxDetailsTotal: 8,
        maxDetailsUsed: detailsBudgetUsed,
        perScenarioDetailBudgets: cases.map(({ id, detailBudget }) => ({ id, detailBudget })),
        queries: cases.length,
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
    };
    const outputPath = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-live-observation.json"
    );
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_LIVE_OBSERVATION_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_LIVE_OBSERVATION_JSON_END");
    console.log(`Report written to ${outputPath}`);
    expect(reports).toHaveLength(cases.length);
  },
  300_000
);
