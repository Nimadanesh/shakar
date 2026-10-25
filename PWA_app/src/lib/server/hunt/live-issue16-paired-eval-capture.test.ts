import { it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

const targetQuery = "کاتالیزور خودرو";
const category = "vehicles";
const detailBudget = 24;
const pagesPerQuery = 3;
const retrievalQueries = [
  "کاتالیزور خودرو", "کاتالیزور اگزوز", "کاتالیزور تعمیر",
  "خرید کاتالیزور", "فروش کاتالیزور", "خاک کاتالیزور",
  "کاتالیزور لنت ترمز", "کاتالیزور سنسور اکسیژن",
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
  const offerVerb = /فروش|موجود|دارم|ارائه|تعویض|جایگزین|نو|استوک|قیمت|ارسال|فروشی/.test(d);
  const serviceOnly = /تعمیر|تعمیرکار|اجرت|جوشکار|جوشکاری|بازکردن|تست|شستشو|سرویس/.test(d)
    && !/فروش|موجود|دارم|ارائه|تعویض|جایگزین/.test(d);
  const buyerSeeking = /خریدار|خریداری می.?کنم|خرید کاتالیزور|خریدار کاتالیزور|خریدار ضایعات/.test(full)
    && !/فروش|موجود|دارم|ارائه/.test(d);
  const dustSubtype = /خاک کاتالیزور|پودر کاتالیزور|پودر کاتالیز|خاک کاتالیز/.test(full);
  const itemList = /،|؛|یک عدد|یک دست|[0-9]+\s*(عدد|دست|حلقه)/.test(d);
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
    const pool: Array<{ candidate: any; query: string; stats: any }> = [];
    const queryReports: Array<Record<string, unknown>> = [];
    const inspected: Array<Record<string, unknown>> = [];
    let detailsUsed = 0;
    try {
      for (const query of retrievalQueries) {
        const def = resolve(query);
        if (!def) { queryReports.push({ query, status: "unresolved" }); continue; }
        const events: HuntEvent[] = [];
        try {
          const { candidates, stats, endCursor } = await collectCandidates(def, {
            maxPages: pagesPerQuery, emit: event => events.push(event),
          });
          let added = 0;
          for (const candidate of candidates) {
            if (previouslyInspectedIds.has(candidate.sourceAdId)) { overlap.add(candidate.sourceAdId); continue; }
            if (seen.has(candidate.sourceAdId)) continue;
            seen.add(candidate.sourceAdId);
            pool.push({ candidate, query, stats });
            added++;
            if (pool.length >= detailBudget || added >= 6) break;
          }
          queryReports.push({
            query, status: added ? "candidates-selected" : "no-new-candidates",
            pagesCompleted: events.filter(e => e.type === "lists-progress").length,
            adsSeen: stats.adsSeen, candidateCount: candidates.length,
            candidatesSelected: added, cursorReturned: endCursor != null,
          });
        } catch (error) {
          queryReports.push({
            query, status: "provider-error",
            error: error instanceof Error ? error.message : String(error),
            pagesCompleted: events.filter(e => e.type === "lists-progress").length,
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
          sourceAdId: entry.candidate.sourceAdId, retrievalQuery: entry.query, targetQuery,
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
        sourceAdId: item.sourceAdId, retrievalQuery: item.retrievalQuery, targetQuery: item.targetQuery,
        title: item.title, descriptionSnapshot: item.descriptionSnapshot,
        descriptionSnapshotAvailable: item.descriptionSnapshotAvailable,
        observationTimestamp: item.observationTimestamp, sourceOnlyTags: item.sourceOnlyTags,
        targetMention: item.targetMention, targetInTitle: item.targetInTitle,
        targetInBody: item.targetInBody, bodyOnly: item.bodyOnly,
      }));
      const positiveCount = blindPacket.filter(x => x.bodyOnly && x.sourceOnlyTags.includes("explicit-target-offer")).length;
      const negativeCount = blindPacket.length - positiveCount;
      const controlCounts = {
        repairServiceOnly: blindPacket.filter(x => x.sourceOnlyTags.includes("repair-service-only")).length,
        buyerSeeking: blindPacket.filter(x => x.sourceOnlyTags.includes("buyer-seeking")).length,
        dustSubtype: blindPacket.filter(x => x.sourceOnlyTags.includes("dust-subtype")).length,
        incidentalOrAmbiguous: blindPacket.filter(x => x.sourceOnlyTags.includes("incidental-or-ambiguous")).length,
      };
      const allControlQuotasMet = Object.values(controlCounts).every(count => count >= 2);
      const report = {
        kind: "issue16-prospective-paired-evaluation-source-only-packet",
        status: blindPacket.length === 12 && positiveCount === 4 && allControlQuotasMet ? "candidate-packet-ready-for-human-review" : "quota-shortfall",
        warning: "SOURCE-ONLY PACKET. No engine verdicts, scores, eligibility, or shadow outcomes are included. Source tags are heuristic candidate-selection aids, not human grades. Human grades must be locked before a separate comparison stage.",
        createdAt: new Date().toISOString(), branch: process.env.GITHUB_REF_NAME ?? "local",
        commit: process.env.GITHUB_SHA ?? "local", runtime: process.version, targetQuery,
        requestedCategory: category, limits: { pagesPerQuery, detailBudget, detailsUsed,
          uniqueCandidateIds: seen.size, overlapWithPreviouslyInspected: [...overlap] },
        previouslyInspectedIdCount: previouslyInspectedIds.size, queryReports,
        quotaStatus: { requestedTotal: 12, selectedTotal: blindPacket.length,
          requestedPositives: 4, selectedBodyOnlyOfferCandidates: positiveCount,
          requestedNegativeControls: 8, selectedNegativeControls: negativeCount, negativeControlTags: controlCounts, categorySelection, allControlQuotasMet },
        candidateReviewPool: inspected, blindPacket,
      };
      await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
      console.log("ISSUE16_PAIRED_EVAL_SOURCE_PACKET_BEGIN");
      console.log(JSON.stringify(report, null, 2));
      console.log("ISSUE16_PAIRED_EVAL_SOURCE_PACKET_END");
      expect(blindPacket.length, "Report quota shortfall; never pad with duplicates").toBe(12);
      expect(positiveCount, "Need four body-only explicit-offer candidates; never auto-grade").toBe(4);
      expect(allControlQuotasMet, "Need at least two examples in each negative-control category; report shortfall otherwise").toBe(true);
    } finally {
      if (oldBuffer === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH; else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBuffer;
      if (oldCap === undefined) delete process.env.HUNT_MAX_DETAILS; else process.env.HUNT_MAX_DETAILS = oldCap;
      if (oldShadow === undefined) delete process.env.MIZAN_SHADOW; else process.env.MIZAN_SHADOW = oldShadow;
    }
  }, 240_000,
);
