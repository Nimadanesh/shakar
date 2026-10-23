import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { assessListingRole, assessQueryIntent, isMixedTransactionTitle } from "./semantics";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

function transactionCueClass(title: string): string {
  const normalized = normalizeForMatch(title);
  if (/خرید\s*و\s*فروش|خریدوفروش/.test(normalized)) return "explicit-buy-sell-catalogue";
  if (/فروش\s*و\s*خریدار|خریدار\s*و\s*فروش/.test(normalized)) return "sale-and-buyer-cues";
  if (/فروش\s+نه\s+خریدار/.test(normalized)) return "sale-not-buyer-contrast";
  if (/فروشنده|خریدار/.test(normalized)) return "single-side-role-cue";
  return "none";
}

it("classifies transaction title cues for diagnostics without changing ranking", () => {
  expect(transactionCueClass("خریدوفروش انواع یخچال")).toBe("explicit-buy-sell-catalogue");
  expect(transactionCueClass("فروش و خریدار یخچال ساید")).toBe("sale-and-buyer-cues");
  expect(transactionCueClass("فروش وخریدار یخچال ساید")).toBe("sale-and-buyer-cues");
  expect(transactionCueClass("فروش نه خریدار یخچال")).toBe("sale-not-buyer-contrast");
  expect(transactionCueClass("فروش یخچال")).toBe("none");
});

/**
 * Read-only regression probe for role direction. Separate from the negative
 * repair-history observation so each experiment has an explicit detail budget.
 * This probe scans up to eight cursor-chained list pages per query, but keeps
 * the same two-detail-per-query and four-detail-total caps.
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
          maxPages: 8,
          emit: (event) => events.push(event),
        });
        // Prefer the frozen human-graded pair if retrieval returns either ID.
        // This changes only the read-only probe's detail allocation, never production ranking.
        const packetTargetIds = new Set(["gaT3a_qu", "gabbQJUc"]);
        const packetCandidates = candidates.filter((candidate) => packetTargetIds.has(candidate.sourceAdId));
        const roleHint = (title: string) =>
          /خریدار|خریداریم|خریدارم|می\s?خوام|می\s?خواهیم|فروش|فروشی|فروشنده/.test(title);
        const titleRoleClass = (title: string): "mixed" | "buyer-only" | "seller-only" | "other" => {
          const normalized = normalizeForMatch(title);
          const hasBuyer = /خریدار|خریداریم|خریدارم/.test(normalized);
          const hasSeller = /فروش|فروشی|فروشنده/.test(normalized);
          if (hasBuyer && hasSeller) return "mixed";
          if (hasBuyer) return "buyer-only";
          if (hasSeller) return "seller-only";
          return "other";
        };
        const roleCandidates = candidates.filter((candidate) => roleHint(candidate.title));
        const titleRoleCounts = roleCandidates.reduce<Record<string, number>>((counts, candidate) => {
          const roleClass = titleRoleClass(candidate.title);
          counts[roleClass] = (counts[roleClass] ?? 0) + 1;
          return counts;
        }, {});
        // Stratify the tiny detail budget so a first-page title-order accident
        // cannot consume every slot with the same role class. This is still
        // an unjudged sample; cue classes are diagnostic heuristics only.
        const desiredRoleClasses = scenario.id === "seek-seller-refrigerator"
          ? ["buyer-only", "mixed", "seller-only", "other"]
          : ["seller-only", "mixed", "buyer-only", "other"];
        const roleStratified: typeof candidates = [];
        for (const desiredClass of desiredRoleClasses) {
          const candidate = roleCandidates.find((item) =>
            titleRoleClass(item.title) === desiredClass &&
            !roleStratified.some((picked) => picked.sourceAdId === item.sourceAdId)
          );
          if (candidate) roleStratified.push(candidate);
          if (roleStratified.length >= scenario.detailBudget) break;
        }
        const selectedIds = new Set<string>();
        const detailCandidates = [
          ...packetCandidates,
          ...roleStratified,
          ...roleCandidates,
          ...candidates,
        ].filter((candidate) => {
          if (selectedIds.has(candidate.sourceAdId) || selectedIds.size >= scenario.detailBudget) return false;
          selectedIds.add(candidate.sourceAdId);
          return true;
        });
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
            pagesRequested: 8,
            pagesCompleted: events.filter((event) => event.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            titleRejected: stats.titleRejected,
            duplicatesCollapsed: stats.dupsCollapsed,
            candidatesAfterFilters: candidates.length,
            roleHintCandidates: roleCandidates.length,
            titleRoleCueCounts: titleRoleCounts,
            providerKeywordTerms: def.include,
            packetTargetCandidatesFound: packetCandidates.map((candidate) => ({
              sourceAdId: candidate.sourceAdId,
              title: candidate.title,
            })),
            detailSelection: packetCandidates.length > 0
              ? "frozen-packet-targets-then-stratified-role-cues"
              : roleStratified.length > 0
                ? "stratified-role-cue-sample"
                : "default-title-strength-order",
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
              // Reconstruct the current title-only cue for diagnosis; this is an estimate, not an internal score trace.
              listingRole: assessListingRole(listingText),
              mixedTransactionTitleCue: isMixedTransactionTitle(result.title),
              transactionCueClass: transactionCueClass(result.title),
              cueDerivedScoringRoleEstimate: isMixedTransactionTitle(result.title)
                ? "mixed-buyer-seller"
                : assessListingRole(listingText).role,
              expectedMixedTransactionPenalty: isMixedTransactionTitle(result.title)
                ? 3
                : 0,
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
        maxListPagesPerQuery: 8,
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
