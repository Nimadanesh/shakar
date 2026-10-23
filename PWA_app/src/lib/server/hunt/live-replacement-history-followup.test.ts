import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { assessListingRole, assessQueryIntent } from "./semantics";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

/**
 * Follow-up harness revision 1: keep this query isolated from the eight-detail main probe.
 * Read-only, bounded follow-up for the replacement-history evidence gap.
 * This deliberately captures live text only; it makes no relevance assertions
 * and must not be treated as a quality score or paired comparison.
 */
it.skipIf(process.env.LIVE_REPLACEMENT_HISTORY_FOLLOWUP !== "1")(
  "captures a bounded positive-replacement-history control for blind review",
  async () => {
    const query = "پیانو قطعات تعویض شده";
    const detailBudget = 2;
    process.env.HUNT_MAX_DETAILS = String(detailBudget);
    const def = resolveHuntDefinition({
      query,
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
    expect(def, "definition must resolve for the positive replacement-history query").not.toBeNull();
    if (!def) return;

    const events: HuntEvent[] = [];
    const { candidates, stats, endCursor } = await collectCandidates(def, {
      maxPages: 2,
      emit: (event) => events.push(event),
    });
    const historyHint = (title: string) =>
      /تعویض|قطعات|اصلی|اورجینال|فابریک|تعمیر/.test(title);
    const hinted = candidates.filter((candidate) => historyHint(candidate.title));
    const selected = [
      ...hinted,
      ...candidates.filter((candidate) => !historyHint(candidate.title)),
    ].slice(0, detailBudget);
    const candidatePool = selected.map((candidate) => ({
      sourceAdId: candidate.sourceAdId,
      title: candidate.title,
    }));
    const results = await confirmCandidates(selected, def, stats, (event) => events.push(event));

    const report = {
      kind: "read-only-live-replacement-history-followup",
      warning: "Unjudged bounded live observation only; not a relevance score or paired quality comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      query,
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
      limits: {
        maxListPages: 2,
        pagesCompleted: events.filter((event) => event.type === "lists-progress").length,
        adsSeen: stats.adsSeen,
        candidatesAfterFilters: candidates.length,
        titleCueCandidates: hinted.length,
        maxDetails: detailBudget,
        detailsChecked: stats.detailsChecked,
        mizanShadow: process.env.MIZAN_SHADOW ?? "0",
        cursorReturned: endCursor !== undefined && endCursor !== null,
      },
      candidatePool,
      results: results.map((result, index) => ({
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
        description: result.descAuditText ?? result.descSnippet ?? "",
        listingRole: assessListingRole(`${result.title} ${result.descAuditText ?? result.descSnippet ?? ""}`),
      })),
      rejectedSample: stats.rejectedSample,
    };
    const outputPath = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-replacement-history-followup.json"
    );
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_REPLACEMENT_HISTORY_FOLLOWUP_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_REPLACEMENT_HISTORY_FOLLOWUP_JSON_END");
    console.log(`Report written to ${outputPath}`);
    expect(stats.detailsChecked).toBeLessThanOrEqual(detailBudget);
  },
  180_000
);
