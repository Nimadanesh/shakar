import { describe, expect, it } from "vitest";
import { buildClassificationReport } from "./stage3-classify-missing-good.mjs";

describe("post-grade classification recovery", () => {
  it("preserves 788 missing hunt-token pairs, counts 786 unique tokens, and separates 707 live from 81 expired", () => {
    const missingGood: { huntId: string; token: string; grade: number }[] = [];
    const detailByToken = new Map<string, { classification: string; status: number; sectionsPresent: boolean; reason: string; detail: null }>();

    // 707 graded pairs share 705 distinct live tokens (two cross-hunt repeats).
    for (let index = 0; index < 707; index += 1) {
      const token = index >= 705 ? `live-${index - 705}` : `live-${index}`;
      missingGood.push({ huntId: index % 2 === 0 ? "H01" : "H02", token, grade: 2 });
    }
    for (let index = 0; index < 705; index += 1) {
      detailByToken.set(`live-${index}`, {
        classification: "live", status: 200, sectionsPresent: true,
        reason: "http-200-sections-present", detail: null,
      });
    }

    // 81 additional pairs/tokens are expired, giving 788 pairs and 786 unique tokens.
    for (let index = 0; index < 81; index += 1) {
      const token = `expired-${index}`;
      missingGood.push({ huntId: "H03", token, grade: 1 });
      detailByToken.set(token, {
        classification: "expired", status: 404, sectionsPresent: false,
        reason: "gone-status", detail: null,
      });
    }

    const report = buildClassificationReport(missingGood, detailByToken);
    expect(report).toMatchObject({
      missingGoodTokenCount: 788,
      uniqueTokenCount: 786,
      detailRequestCount: 786,
      liveButMissedCount: 707,
      expiredCount: 81,
      unclassifiedCount: 0,
      replayIncompleteDueToUnclassifiedDetails: false,
    });
    expect(report.items).toHaveLength(788);
  });
});
