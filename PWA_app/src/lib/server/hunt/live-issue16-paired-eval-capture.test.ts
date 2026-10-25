import { it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

// Prospective capture stays source-only; engine comparison is a separate, post-grade stage.
// Live execution is intentionally gated by the explicit commit marker in the dedicated workflow.
// Retrieval is deliberately broader than the target so body-only target mentions can be discovered.
const targetQuery = "کاتالیزور خودرو";
const category = "vehicles";
const detailBudget = 24;
const pagesPerQuery = 4;
const retrievalQueries = [
  // Broaden source discovery across direct-target, adjacent-parts, general-parts,
  // and negative-control intents. Keep this capture source-only and bounded.
  "کاتالیزور خودرو", "قطعات خودرو", "قطعات یدکی خودرو", "لوازم یدکی ماشین",
  "لوازم موتوری خودرو", "فروش قطعات خودرو", "سنسور اکسیژن خودرو",
  "هدرز خودرو", "اگزوز خودرو", "تعمیر کاتالیزور خودرو",
  "خرید کاتالیزور خودرو", "خرید ضایعات خودرو",
];

function resolve(query: string) {
  return resolveHuntDefinition({
    query, include: [], exclude: [], should: [], city: "all", category,
    priceMin: "", priceMax: "", transaction: "", condition: "",
  });
}
function norm(value: string) {
  return normalizeForMatch(value ?? "").replace(/\s+/g, " ").trim();
}
function extractPreviouslyInspectedIds(contents: string[]): Set<string> {
  // Dynamically aggregate existing capture-source IDs instead of maintaining a stale copied list.
  const ids = new Set<string>();
  for (const source of contents) {
    for (const match of source.matchAll(/["']([A-Za-z0-9_-]{8})["']/g)) ids.add(match[1]);
  }
  return ids;
}
function classifySourceOnly(title: string, description: string) {
  const t = norm(title), d = norm(description), full = norm(title + " " + description);
  const targetMention = /کاتالیزور|کاتالیز/.test(full);
  const targetInTitle = /کاتالیزور|کاتالیز/.test(t);
  const offerVerb = /فروش|موجود|دارم|عرضه|ارائه|تعویض|جایگزین|فروشی|به فروش|قابل تهیه/.test(d);
  const serviceOnly = /تعمیر|تعمیرکار|اجرت|جوشکار|جوشکاری|بازکردن|تست|شستشو|سرویس/.test(d)
    && !/فروش|موجود|دارم|ارائه|تعویض|جایگزین/.test(d);
  const buyerSeeking = /خریدار|خریداری می.?کنم|خرید کاتالیزور|خریدار کاتالیزور|خریدار ضایعات/.test(full)
    && !/فروش|موجود|دارم|ارائه/.test(d);
  const dustSubtype = /خاک کاتالیزور|پودر کاتالیزور|پودر کاتالیز|خاک کاتالیز/.test(full);
  // Punctuation is removed by normalizeForMatch, so inspect the raw description for list separators.
  const itemList = /[،؛,;]|یک عدد|یک دست|[0-9]+\s*(عدد|دست|حلقه)/.test(description) || /یک عدد|یک دست|[0-9]+\s*(عدد|دست|حلقه)/.test(d);
  const explicitOffer = targetMention && offerVerb && !buyerSeeking && !serviceOnly && !dustSubtype;
  const tags: string[] = [];
  if (serviceOnly) tags.push("repair-service-only");
  if (buyerSeeking) tags.push("buyer-seeking");
  if (dustSubtype) tags.push("dust-subtype");
  if (targetMention && !explicitOffer && !buyerSeeking && !dustSubtype && !serviceOnly) tags.push("incidental-or-ambiguous");
  if (explicitOffer) tags.push("explicit-target-offer");
  if (itemList) tags.push("item-list");
  return {
    targetMention, targetInTitle, targetInBody: /کاتالیزور|کاتالیز/.test(d),
    bodyOnly: targetMention && !targetInTitle, sourceOnlyTags: tags,
    provisionalArm: explicitOffer ? "candidate-positive" : (tags[0] ?? "unclassified"),
  };
}

it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "Issue 16 prospective paired-evaluation source-only capture",
  async () => {
    const outputPath = join(process.cwd(), "engine-v3-issue16-paired-eval-source-packet.json");
    const oldBuffer = process.env.SLUG_CAPTURE_BUFFER_PATH;
    const oldCap = process.env.HUNT_MAX_DETAILS;
    const oldShadow = process.env.MIZAN_SHADOW;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(process.env.RUNNER_TEMP ?? process.cwd(), "issue16-paired-eval-slugs.jsonl");
    process.env.HUNT_MAX_DETAILS = String(detailBudget);
    process.env.MIZAN_SHADOW = "0";
    const sources = await Promise.all([
      "live-issue16-capture-06a.test.ts",
      "live-issue16-capture-06b.test.ts",
      "live-issue16-capture-06c.test.ts",
    ].map(name => readFile(join(process.cwd(), "src/lib/server/hunt", name), "utf8")));
    const previouslyInspectedIds = extractPreviouslyInspectedIds(sources);
    const seen = new Set<string>(), overlap = new Set<string>();
    const pool: Array<{ candidate: any; query: string; pageNumber: number; stats: any }> = [];
    const queryReports: Array<Record<string, unknown>> = [];
    const inspected: Array<Record<string, unknown>> = [];
    let detailsUsed = 0;
    try {
      for (const query of retrievalQueries) {
        const def = resolve(query);
        if (!def) { queryReports.push({ query, status: "unresolved" }); continue; }
        let added = 0;
        let pagesCompleted = 0;
        let adsSeen = 0;
        let candidateCount = 0;
        let cursor: unknown = undefined;
        let cursorReturned = false;
        try {
          for (let pageIndex = 0; pageIndex < pagesPerQuery; pageIndex++) {
            const events: HuntEvent[] = [];
            const result = await collectCandidates(def, {
              maxPages: 1, startPage: pageIndex, startCursor: cursor,
              emit: event => events.push(event),
            });
            pagesCompleted += events.filter(e => e.type === "lists-progress").length;
            adsSeen += result.stats.adsSeen;
            candidateCount += result.candidates.length;
            cursor = result.endCursor;
            cursorReturned = cursor != null;
            // Sample one novel listing per page, rotating the within-page position,
            // and at most two per query. This forces later-page coverage instead of
            // spending each query's allowance on page one.
            const candidateIndexes = result.candidates.map((_: unknown, index: number) => index);
            const anchorRatio = [0.15, 0.5, 0.85][pageIndex % 3];
            const anchor = Math.round(Math.max(0, result.candidates.length - 1) * anchorRatio);
            candidateIndexes.sort((a, b) =>
              Math.abs(a - anchor) - Math.abs(b - anchor) || a - b,
            );
            let addedThisPage = 0;
            for (const candidateIndex of candidateIndexes) {
              const candidate = result.candidates[candidateIndex];
              if (previouslyInspectedIds.has(candidate.sourceAdId)) { overlap.add(candidate.sourceAdId); continue; }
              if (seen.has(candidate.sourceAdId)) continue;
              seen.add(candidate.sourceAdId);
              pool.push({ candidate, query, pageNumber: pageIndex + 1, stats: result.stats });
              added++;
              addedThisPage++;
              if (pool.length >= detailBudget || addedThisPage >= 1) break;
            }
            if (pool.length >= detailBudget || added >= 2 || cursor == null) break;
          }
          queryReports.push({
            query, status: added ? "candidates-selected" : "no-new-candidates",
            pagesCompleted, adsSeen, candidateCount,
            candidatesSelected: added, cursorReturned,
          });
        } catch (error) {
          queryReports.push({
            query, status: "provider-error",
            error: error instanceof Error ? error.message : String(error),
            pagesCompleted, adsSeen, candidateCount,
          });
        }
        if (pool.length >= detailBudget) break;
      }
      const targetDef = resolve(targetQuery);
      if (!targetDef) throw new Error("Target hunt definition did not resolve");
      for (const entry of pool.slice(0, detailBudget)) {
        // Use the pipeline only to retrieve a verified source snapshot. Discard all engine outcomes.
        const stats: any = entry.stats;
        const detailsBefore = stats.detailsChecked;
        const scored = await confirmCandidates([entry.candidate], targetDef, stats, () => {});
        detailsUsed += stats.detailsChecked - detailsBefore;
        if (detailsUsed > detailBudget) throw new Error("Detail budget exceeded");
        const hit = scored.find((x: any) => x.sourceAdId === entry.candidate.sourceAdId);
        const rejected = stats.rejectedSample.find((x: any) => x.sourceAdId === entry.candidate.sourceAdId);
        const description = hit?.descAuditText ?? rejected?.descAuditText ?? "";
        const source = classifySourceOnly(entry.candidate.title, description);
        inspected.push({
          sourceAdId: entry.candidate.sourceAdId, retrievalQuery: entry.query, retrievalPage: entry.pageNumber, targetQuery,
          title: entry.candidate.title, descriptionSnapshot: description,
          descriptionSnapshotAvailable: Boolean(description), observationTimestamp: new Date().toISOString(),
          sourceOnlyTags: source.sourceOnlyTags, targetMention: source.targetMention,
          targetInTitle: source.targetInTitle, targetInBody: source.targetInBody,
          bodyOnly: source.bodyOnly, provisionalArm: source.provisionalArm,
        });
      }
      // These are candidate-selection heuristics only; human grades are never generated here.
      const positives = inspected.filter(x => x.provisionalArm === "candidate-positive" && x.bodyOnly).slice(0, 4);
      const negativeCandidates = inspected.filter(x => x.provisionalArm !== "candidate-positive");
      const categoryTags = [
        "repair-service-only", "buyer-seeking", "dust-subtype", "incidental-or-ambiguous",
      ];
      const chosenNegativeIds = new Set<string>();
      const categorySelection: Record<string, number> = {};
      // Satisfy each control quota where possible; overlapping tags may satisfy more than one category.
      for (const tag of categoryTags) {
        let count = 0;
        for (const candidate of negativeCandidates) {
          if (count >= 2) break;
          if (chosenNegativeIds.has(candidate.sourceAdId) || !candidate.sourceOnlyTags.includes(tag)) continue;
          chosenNegativeIds.add(candidate.sourceAdId);
          count++;
        }
        categorySelection[tag] = count;
      }
      for (const candidate of negativeCandidates) {
        if (chosenNegativeIds.size >= 8) break;
        chosenNegativeIds.add(candidate.sourceAdId);
      }
      const selectedNegatives = negativeCandidates.filter(x => chosenNegativeIds.has(x.sourceAdId)).slice(0, 8);
      const packetRaw = [...positives, ...selectedNegatives].slice(0, 12);
      const blindPacket = packetRaw.map((item: any, index) => ({
        blindId: "P" + String(index + 1).padStart(2, "0"),
        sourceAdId: item.sourceAdId, retrievalQuery: item.retrievalQuery, retrievalPage: item.retrievalPage, targetQuery: item.targetQuery,
        title: item.title, descriptionSnapshot: item.descriptionSnapshot,
        descriptionSnapshotAvailable: item.descriptionSnapshotAvailable,
        observationTimestamp: item.observationTimestamp,
      }));
      const positiveItems = packetRaw.filter(x => x.bodyOnly && x.sourceOnlyTags.includes("explicit-target-offer"));
      const positiveCount = positiveItems.length;
      const itemListPositiveCount = positiveItems.filter(x => x.sourceOnlyTags.includes("item-list")).length;
      const negativeCount = blindPacket.length - positiveCount;
      const controlCounts = {
        repairServiceOnly: packetRaw.filter(x => x.sourceOnlyTags.includes("repair-service-only")).length,
        buyerSeeking: packetRaw.filter(x => x.sourceOnlyTags.includes("buyer-seeking")).length,
        dustSubtype: packetRaw.filter(x => x.sourceOnlyTags.includes("dust-subtype")).length,
        incidentalOrAmbiguous: packetRaw.filter(x => x.sourceOnlyTags.includes("incidental-or-ambiguous")).length,
      };
      const allControlQuotasMet = Object.values(controlCounts).every(count => count >= 2);
      const reportCore = {
        kind: "issue16-prospective-paired-evaluation-source-only-packet",
        status: blindPacket.length === 12 && positiveCount === 4 && itemListPositiveCount >= 1 && allControlQuotasMet ? "candidate-packet-ready-for-human-review" : "quota-shortfall",
        warning: "SOURCE-ONLY PACKET. No engine verdicts, scores, eligibility, or shadow outcomes are included. Source tags are heuristic candidate-selection aids, not human grades. Human grades must be locked before a separate comparison stage.",
        createdAt: new Date().toISOString(), branch: process.env.GITHUB_REF_NAME ?? "local",
        commit: process.env.GITHUB_SHA ?? "local", runtime: process.version, targetQuery,
        requestedCategory: category, limits: { pagesPerQuery, detailBudget, detailsUsed,
          uniqueCandidateIds: seen.size, overlapWithPreviouslyInspected: [...overlap] },
        previouslyInspectedIdCount: previouslyInspectedIds.size, queryReports,
        quotaStatus: { requestedTotal: 12, selectedTotal: blindPacket.length,
          requestedPositives: 4, selectedBodyOnlyOfferCandidates: positiveCount, itemListPositiveCount,
          requestedNegativeControls: 8, selectedNegativeControls: negativeCount, negativeControlTags: controlCounts, categorySelection, allControlQuotasMet },
        // Diagnostic-only selector audit: heuristic arms explain selection, not relevance; never part of the blind packet or human grades.
        selectionAudit: inspected.map((item: any) => ({ sourceAdId: item.sourceAdId, retrievalQuery: item.retrievalQuery, retrievalPage: item.retrievalPage, targetMention: item.targetMention, targetInTitle: item.targetInTitle, targetInBody: item.targetInBody, bodyOnly: item.bodyOnly, sourceOnlyTags: item.sourceOnlyTags, provisionalArm: item.provisionalArm })),
        blindPacket,
      };
      const sourcePacketSha256 = createHash("sha256").update(JSON.stringify(reportCore)).digest("hex");
      const report = { ...reportCore, sourcePacketSha256 };
      await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
      console.log("ISSUE16_PAIRED_EVAL_SOURCE_PACKET_BEGIN");
      console.log(JSON.stringify(report, null, 2));
      console.log("ISSUE16_PAIRED_EVAL_SOURCE_PACKET_END");
      expect(blindPacket.length, "Report quota shortfall; never pad with duplicates").toBe(12);
      expect(positiveCount, "Need four body-only explicit-offer candidates; never auto-grade").toBe(4);
      expect(itemListPositiveCount, "Need at least one item-list positive control").toBeGreaterThanOrEqual(1);
      expect(allControlQuotasMet, "Need at least two examples in each negative-control category; report shortfall otherwise").toBe(true);
    } finally {
      if (oldBuffer === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH; else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBuffer;
      if (oldCap === undefined) delete process.env.HUNT_MAX_DETAILS; else process.env.HUNT_MAX_DETAILS = oldCap;
      if (oldShadow === undefined) delete process.env.MIZAN_SHADOW; else process.env.MIZAN_SHADOW = oldShadow;
    }
  }, 240_000,
);
