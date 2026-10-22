import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveHuntDefinition } from "./definition";
import { divarProvider } from "../divar/divarClient";
import { ProviderError } from "../divar/provider";
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
function redactIranianPhoneNumbers(value: string): string {
  const asciiDigits = value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10)
  );
  const mobileRedacted = asciiDigits.replace(
    /(?<!\d)(?:(?:\+|00)?98[\s().-]*)?0?9(?:[\s().-]*\d){9}(?!\d)/g,
    "[REDACTED_PHONE]"
  );
  // Also scrub common Iranian fixed-line formats with local area codes.
  return mobileRedacted.replace(
    /(?<!\d)(?:(?:\+|00)?98[\s()._-]*)?0?(?:[1-8]\d{1,2})[\s()._-]*\d(?:[\s()._-]*\d){6,7}(?!\d)/g,
    "[REDACTED_PHONE]"
  );
}
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION !== "1")(
  "captures a bounded live Divar observation for critical query families",
  async () => {
    expect(redactIranianPhoneNumbers("09123456789")).toBe("[REDACTED_PHONE]");
    expect(redactIranianPhoneNumbers("+98 912 345 6789")).toBe("[REDACTED_PHONE]");
    expect(redactIranianPhoneNumbers("0098-912-345-6789")).toBe("[REDACTED_PHONE]");
    expect(redactIranianPhoneNumbers("۰۹۱۲۳۴۵۶۷۸۹")).toBe("[REDACTED_PHONE]");
    expect(redactIranianPhoneNumbers("21_22200017")).toBe("[REDACTED_PHONE]");
    expect(redactIranianPhoneNumbers("021 22200017")).toBe("[REDACTED_PHONE]");

    const sourceMatchedTargets = [
      { label: "P01", sourceAdId: "gaiCb1F-" },
      { label: "P02", sourceAdId: "gaZze3Z1" },
      { label: "P03", sourceAdId: "gaZzOCha" },
      { label: "P04", sourceAdId: "gaZb-8lt" },
      { label: "P05", sourceAdId: "gaZnujck" },
      { label: "P06", sourceAdId: "Qa0_1GLb" },
      { label: "K01", sourceAdId: "gaZvu9P8" },
    ] as const;

    const cases = [
      { id: "piano-identity", query: "پیانو اکوستیک" },
      { id: "part-vs-whole", query: "کفی ماشین" },
      { id: "explicit-flatbed-counter-intent", query: "کفی تریلی" },
      { id: "service-intent", query: "تعمیر یخچال" },
      { id: "explicit-absence", query: "ماشین بدون رنگ" },
    ] as const;

    const reports: Array<Record<string, unknown>> = [];
    const oldBufferPath = process.env.SLUG_CAPTURE_BUFFER_PATH;
    process.env.SLUG_CAPTURE_BUFFER_PATH = join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      "engine-v3-live-observation-slug-buffer.jsonl"
    );

    try {
      for (const scenario of cases) {
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
        const results = await confirmCandidates(
          candidates,
          def,
          stats,
          (event) => events.push(event)
        );

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
          retrieval: {
            pagesRequested: 2,
            pagesCompleted: events.filter((e) => e.type === "lists-progress").length,
            adsSeen: stats.adsSeen,
            titleRejected: stats.titleRejected,
            duplicatesCollapsed: stats.dupsCollapsed,
            candidatesAfterFilters: candidates.length,
            detailsChecked: stats.detailsChecked,
            confirmed: stats.confirmed,
            nearMiss: stats.nearMiss,
            rejectedNoMatch: stats.rejectedNoMatch,
            stale: stats.stale,
            slugCapture: stats.slugCapture ?? null,
            cursorReturned: endCursor !== undefined && endCursor !== null,
          },
          topResults: results.slice(0, 8).map((result, index) => ({
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
            descriptionExcerpt: result.descSnippet,
            ...(process.env.HUNT_CAPTURE_FULL_DETAILS === "1" && result.descriptionSnapshot !== undefined
              ? { descriptionSnapshot: redactIranianPhoneNumbers(result.descriptionSnapshot) }
              : {}),
          })),
        });
      }
    } finally {
      if (oldBufferPath === undefined) delete process.env.SLUG_CAPTURE_BUFFER_PATH;
      else process.env.SLUG_CAPTURE_BUFFER_PATH = oldBufferPath;
    }

    const sourceMatchedDetails: Array<Record<string, unknown>> = [];
    if (process.env.HUNT_CAPTURE_FULL_DETAILS === "1") {
      for (const target of sourceMatchedTargets) {
        try {
          const detail = await divarProvider.getDetail(target.sourceAdId);
          sourceMatchedDetails.push({
            label: target.label,
            sourceAdId: target.sourceAdId,
            title: detail.title,
            stale: detail.stale ?? false,
            categorySlug: detail.categorySlug,
            descriptionSnapshot: redactIranianPhoneNumbers(detail.description),
          });
        } catch (error) {
          sourceMatchedDetails.push({
            label: target.label,
            sourceAdId: target.sourceAdId,
            fetchStatus: "failed",
            errorClass: error instanceof ProviderError ? error.errorClass : "unknown",
          });
        }
      }
    }

    const report = {
      kind: "read-only-live-observation",
      warning: "Unjudged observations only; not a relevance score or a paired quality comparison.",
      createdAt: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME ?? "local",
      commit: process.env.GITHUB_SHA ?? "local",
      runtime: process.version,
      limits: {
        maxListPagesPerQuery: 2,
        maxDetailsPerQuery: Number(process.env.HUNT_MAX_DETAILS ?? "8"),
        queries: cases.length,
        mizanShadow: process.env.MIZAN_SHADOW ?? "default",
      },
      scenarios: reports,
      sourceMatchedDetails,
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
