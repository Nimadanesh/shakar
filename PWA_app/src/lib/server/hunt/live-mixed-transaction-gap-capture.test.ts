import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

type Pattern = "mixed-compact" | "mixed-spaced" | "sale-and-buyer" | "buyer-seeking" | "barter" | "direct-seller" | "other";

function titlePattern(title: string): Pattern {
  const text = normalizeForMatch(title);
  if (/خریدوفروش/.test(text)) return "mixed-compact";
  if (/خرید\s+و\s+فروش/.test(text)) return "mixed-spaced";
  if (/فروش\s*و\s*خریدار|خریدار\s*و\s*فروش/.test(text)) return "sale-and-buyer";
  if (/معاوضه|تهاتر/.test(text)) return "barter";
  if (/خریدار|خریدارم|خریداریم|می\s?خرم/.test(text)) return "buyer-seeking";
  if (/فروش|فروشی|فروشنده/.test(text)) return "direct-seller";
  return "other";
}

/** Narrow read-only supplement for the three uncovered matrix cells. Not a blinded packet or ranking comparison. */
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures bounded evidence for missing mixed-transaction matrix cells",
  async () => {
    const scenarios = [
      {
        id: "compact-mixed-title",
        query: "خریدوفروش یخچال",
        taskIntent: "seek-seller",
        category: "home",
        desired: ["mixed-compact", "mixed-spaced", "sale-and-buyer", "direct-seller"] as const,
        targetPattern: "mixed-compact",
      },
      {
        id: "barter-condition",
        query: "یخچال",
        taskIntent: "generic-product",
        category: "home",
        desired: ["barter", "direct-seller", "buyer-seeking", "other"] as const,
        targetPattern: "barter",
      },
      {
        id: "explicit-buyer-control",
        query: "خریدار یخچال",
        taskIntent: "seek-buyer",
        category: "home",
        desired: ["buyer-seeking", "direct-seller", "barter", "other"] as const,
        targetPattern: "buyer-seeking",
      },
    ] as const;

    const reportPath = join(process.cwd(), "engine-v3-mixed-transaction-gap-capture.json");
    const oldBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    const oldDetailCap = process.env.HUNT_MAX_DETAILS;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(process.cwd(), "engine-v3-mixed-transaction-gap-capture-slugs.jsonl");

    const globalSeen = new Set<string>();
    const reports: Array<Record<string, unknown>> = [];
    let detailsUsed = 0;

    try {
      for (const scenario of scenarios) {
        const remaining = 6 - detailsUsed;
        if (remaining <= 0) break;
        const detailBudget = Math.min(2, remaining);
        process.env.HUNT_MAX_DETAILS = String(detailBudget);

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
        expect(def, "definition must resolve for " + scenario.query).not.toBeNull();
        if (!def) continue;

        const events: HuntEvent[] = [];
        const { candidates, stats, endCursor } = await collectCandidates(def, {
          maxPages: 2,
          emit: (event) => events.push(event),
        });

        const unused = candidates.filter((candidate) => !globalSeen.has(candidate.sourceAdId));
        const selected: typeof candidates = [];
        for (const pattern of scenario.desired) {
          const found = unused.find((candidate) =>
            titlePattern(candidate.title) === pattern &&
            !selected.some((picked) => picked.sourceAdId === candidate.sourceAdId)
          );
          if (found) selected.push(found);
          if (selected.length >= detailBudget) break;
        }
        for (const candidate of unused) {
          if (selected.length >= detailBudget) break;
          if (!selected.some((picked) => picked.sourceAdId === candidate.sourceAdId)) selected.push(candidate);
        }
        selected.forEach((candidate) => globalSeen.add(candidate.sourceAdId));

        const pool = selected.map((candidate) => ({
          sourceAdId: candidate.sourceAdId,
          title: candidate.title,
          price: candidate.price,
          city: candidate.city,
          titlePattern: titlePattern(candidate.title),
        }));

        const scored = await confirmCandidates(selected, def, stats, () => {});
        detailsUsed += stats.detailsChecked;

        const rejected = new Map<string, (typeof stats.rejectedSample)[number]>(
          stats.rejectedSample.map((item) => [item.sourceAdId, item] as const)
        );
        const scoredById = new Map<string, { item: (typeof scored)[number]; sampleRank: number }>(
          scored.map((item, index) => [item.sourceAdId, { item, sampleRank: index + 1 }] as const)
        );
        const listings = pool.map((candidate) => {
          const scoredEntry = scoredById.get(candidate.sourceAdId);
          const rejectedEntry = rejected.get(candidate.sourceAdId);
          const scoredItem = scoredEntry?.item;
          const description = scoredItem?.descAuditText ?? rejectedEntry?.descAuditText ?? "";
          return {
            sourceAdId: candidate.sourceAdId,
            query: scenario.query,
            taskIntent: scenario.taskIntent,
            requestedCategory: scenario.category,
            targetPattern: scenario.targetPattern,
            title: candidate.title,
            descriptionSnapshot: description,
            descriptionSnapshotAvailable: description.length > 0,
            price: candidate.price,
            city: candidate.city,
            titlePattern: candidate.titlePattern,
            targetPatternHit: candidate.titlePattern === scenario.targetPattern,
            classificationNeedsHumanReview: true,
            eligible: Boolean(scoredItem),
            sampleRank: scoredEntry?.sampleRank ?? null,
            productionRank: null,
            matchKind: scoredItem?.matchKind ?? (rejectedEntry ? "rejected" : "unknown"),
            score: scoredItem?.score ?? null,
            evidence: scoredItem?.evidence ?? [],
            missingInfo: scoredItem?.missingInfo ?? [],
            detailUnknown: scoredItem?.detailUnknown ?? !description,
            rejectedKind: rejectedEntry?.kind ?? null,
          };
        });

        reports.push({
          id: scenario.id,
          query: scenario.query,
          taskIntent: scenario.taskIntent,
          requestedCategory: scenario.category,
          targetPattern: scenario.targetPattern,
          targetPatternFoundInSelected: listings.some((listing) => listing.targetPatternHit),
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
            detailBudget,
            detailsChecked: stats.detailsChecked,
            candidatePool: pool,
          },
          listings,
        });
      }
    } finally {
      if (oldBufferPath === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH;
      else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBufferPath;
      if (oldDetailCap === undefined) delete process.env.HUNT_MAX_DETAILS;
      else process.env.HUNT_MAX_DETAILS = oldDetailCap;
    }

    const report = {
      kind: "read-only-live-mixed-transaction-gap-capture",
      warning: "Raw internal evidence only. Not a blinded packet, not human grades, and not a production top-N ranking comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxPagesPerQuery: 2,
        maxDetailsTotal: 6,
        maxDetailsUsed: detailsUsed,
        uniqueListingIds: globalSeen.size,
        scenarios: scenarios.length,
        requestedCategories: ["home"],
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("ENGINE_V3_MIXED_TRANSACTION_GAP_JSON_BEGIN");
    console.log(JSON.stringify(report, null, 2));
    console.log("ENGINE_V3_MIXED_TRANSACTION_GAP_JSON_END");
    console.log("Report written to " + reportPath);

    expect(detailsUsed).toBeLessThanOrEqual(6);
    expect(globalSeen.size).toBeLessThanOrEqual(6);
    expect(reports.length).toBeGreaterThan(0);
  },
  240_000
);
