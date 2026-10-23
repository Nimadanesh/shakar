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
    // Total budget: two history probes, two service-control details, and four exchange
    // details split across trailer and vehicle categories; vehicle target model is Samand for this capture. Do not interpret HUNT_MAX_DETAILS as global.
    const cases = [
      // Include the product plus known replacement-history vocabulary so list
      // retrieval can surface likely real history-bearing ads.
      { id: "negated-replacement-history", query: "پیانو قطعات اورجینال تعویض نشده", detailBudget: 2 },
      // Retrieve likely service ads, but evaluate their details against the
      // negative-history PRODUCT definition. This directly probes cross-intent contamination.
      { id: "repair-service-control", query: "پیانو تعمیر یا تعویض نشده است", candidateQuery: "تعمیر پیانو", detailBudget: 2 },
      { id: "explicit-exchange-flatbed", query: "معاوضه با کفی سه محور", detailBudget: 2 },
      // Cross-category exchange control: use the same bounded detail budget
      // to observe vehicle exchange, rather than duplicating the piano query; this pass switches target model to collect fresh vehicle-side evidence.
      // Seek an explicit target-side paint contradiction control; blind-grade only after checking the complete exchange relation and which vehicle owns the paint claim.
      { id: "explicit-exchange-vehicle-samand", query: "معاوضه سمند رنگ دارد", detailBudget: 2 },
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
        const candidateQuery = "candidateQuery" in scenario ? scenario.candidateQuery : undefined;
        const retrievalDef = candidateQuery
          ? resolveHuntDefinition({
              query: candidateQuery,
              include: [],
              exclude: [],
              should: [],
              city: "all",
              category: "all",
              priceMin: "",
              priceMax: "",
              transaction: "",
              condition: "",
            })
          : def;
        expect(retrievalDef, `retrieval definition must resolve for ${scenario.id}`).not.toBeNull();
        if (!retrievalDef) continue;

        const events: HuntEvent[] = [];
        const pagesRequested = scenario.id === "explicit-exchange-vehicle-samand" ? 8 : 2;
        const { candidates, stats, endCursor } = await collectCandidates(retrievalDef, {
          maxPages: pagesRequested,
          emit: (event) => events.push(event),
        });
        // For the negated-history diagnostic only, spend the small detail
        // budget on titles likely to describe item condition/history. This is
        // deliberately a targeted probe, not a representative rank sample.
        const historyHint = (title: string) =>
          /تعمیر|تعویض|قطعات|اورجینال|اصلی|فابریک|فروشگاه|مرجع/.test(title);
        const historyCandidates = candidates.filter((candidate) => historyHint(candidate.title));
        const serviceHint = (title: string) =>
          /تعمیر|تعمیرکار|سرویس|خدمات|در\s?محل/.test(title);
        const serviceCandidates = candidates.filter((candidate) => serviceHint(candidate.title));
        const paintHint = (title: string) =>
          /بدون\s*رنگ|بی\s*رنگ|بیرنگ|فابریک|رنگ\s*(?:دارد|شده|خورده)|گلگیر\s*رنگ/.test(title);
        const exchangeHint = (title: string) =>
          /معاوضه|تهاتر|تعویض\s*با/.test(title);
        const paintHintCandidates = candidates.filter((candidate) => paintHint(candidate.title));
        const exchangeHintCandidates = candidates.filter((candidate) => exchangeHint(candidate.title));
        const samandExchangeCandidates = candidates.filter(
          (candidate) => /سمند/.test(candidate.title) && exchangeHint(candidate.title)
        );
        const samandPaintExchangeCandidates = candidates.filter(
          (candidate) =>
            /سمند/.test(candidate.title) &&
            paintHint(candidate.title) &&
            exchangeHint(candidate.title)
        );
        const detailCandidates =
          scenario.id === "repair-service-control" && serviceCandidates.length > 0
            ? [
                ...serviceCandidates.slice(0, scenario.detailBudget),
                ...candidates
                  .filter((candidate) => !serviceHint(candidate.title))
                  .slice(0, Math.max(0, scenario.detailBudget - serviceCandidates.length)),
              ]
            : scenario.id === "negated-replacement-history" &&
              historyCandidates.length > 0
              ? [
                  ...historyCandidates.slice(0, scenario.detailBudget),
                  ...candidates
                    .filter((candidate) => !historyHint(candidate.title))
                    .slice(0, Math.max(0, scenario.detailBudget - historyCandidates.length)),
                ]
              : scenario.id === "explicit-exchange-vehicle-samand"
                ? (() => {
                    // Observation-only targeted sampling: prefer a single title that
                    // jointly identifies the target vehicle, paint status, and exchange.
                    // If none exists, spend the bounded budget across both cue families
                    // so detail text can establish whether the cues refer to the same vehicle.
                    const cueInterleaved = [];
                    const cueCount = Math.max(paintHintCandidates.length, exchangeHintCandidates.length);
                    for (let index = 0; index < cueCount; index += 1) {
                      if (paintHintCandidates[index]) cueInterleaved.push(paintHintCandidates[index]);
                      if (exchangeHintCandidates[index]) cueInterleaved.push(exchangeHintCandidates[index]);
                    }
                    // If no title carries all three cues, inspect a Samand+exchange
                    // candidate before a paint-only candidate; its details may establish
                    // whether paint evidence is scoped to the target vehicle.
                    const prioritized = [
                      ...samandPaintExchangeCandidates,
                      ...samandExchangeCandidates,
                      ...cueInterleaved,
                      ...candidates,
                    ];
                    const selected = [];
                    const seen = new Set<string>();
                    for (const candidate of prioritized) {
                      if (seen.has(candidate.sourceAdId)) continue;
                      seen.add(candidate.sourceAdId);
                      selected.push(candidate);
                      if (selected.length >= scenario.detailBudget) break;
                    }
                    return selected;
                  })()
                : candidates.slice(0, scenario.detailBudget);
        // Snapshot before confirmation: confirmCandidates may reorder its input
        // in place, and the report must show the actual pre-confirmation budget.
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
          ...("candidateQuery" in scenario ? { candidateQuery: scenario.candidateQuery } : {}),
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
            pagesRequested,
            pagesCompleted: events.filter((e) => e.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            titleRejected: stats.titleRejected,
            duplicatesCollapsed: stats.dupsCollapsed,
            candidatesAfterFilters: candidates.length,
            detailSelection:
              scenario.id === "repair-service-control"
                ? {
                    method: "service-title-cue-prioritized-control",
                    serviceHintCandidates: serviceCandidates.length,
                  }
                : scenario.id === "negated-replacement-history"
                  ? {
                      method: "title-cue-prioritized-diagnostic",
                      historyHintCandidates: historyCandidates.length,
                    }
                  : scenario.id === "explicit-exchange-vehicle-samand"
                    ? {
                        method: samandPaintExchangeCandidates.length > 0
                          ? "joint-samand-paint-exchange-title-cue-prioritized"
                          : paintHintCandidates.length > 0 && exchangeHintCandidates.length > 0
                            ? "paint-and-exchange-cue-interleaved-for-detail-audit"
                            : paintHintCandidates.length > 0
                              ? "paint-title-cue-prioritized-no-exchange-title-cue"
                              : exchangeHintCandidates.length > 0
                                ? "exchange-title-cue-prioritized-no-paint-title-cue"
                                : "default-title-strength-order-no-paired-cues",
                        paintHintCandidates: paintHintCandidates.length,
                        exchangeHintCandidates: exchangeHintCandidates.length,
                        samandExchangeCandidates: samandExchangeCandidates.length,
                        samandPaintExchangeCandidates: samandPaintExchangeCandidates.length,
                        // Evidence-only inventory: expose the bounded title pool so the next
                        // selector decision can be based on observed candidates rather than
                        // adding another title heuristic blindly. This does not fetch details
                        // or change which candidates are confirmed.
                        samandExchangeTitleInventory: samandExchangeCandidates
                          .slice(0, 40)
                          .map((candidate) => ({
                            sourceAdId: candidate.sourceAdId,
                            title: candidate.title,
                          })),
                      }
                    : { method: "default-title-strength-order" },
            detailsChecked: stats.detailsChecked,
            detailCandidatePool,
            confirmed: stats.confirmed,
            nearMiss: stats.nearMiss,
            rejectedNoMatch: stats.rejectedNoMatch,
            // Preserve detail-phase rejection evidence for diagnostic review.
            rejectedSample: stats.rejectedSample,
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
        maxListPagesPerQuery: 8,
        perScenarioPageBudgets: cases.map(({ id }) => ({ id, maxPages: id === "explicit-exchange-vehicle-samand" ? 8 : 2 })),
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
