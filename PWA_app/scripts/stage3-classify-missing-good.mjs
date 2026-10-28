#!/usr/bin/env node
/**
 * Separate post-grading recovery/classification for a completed Stage 3 replay.
 * Run from PWA_app with Node 24+:
 *   node --experimental-strip-types scripts/stage3-classify-missing-good.mjs [output-dir]
 *
 * Reads saved hunt pools, joins only frozen grade-1..3 records missing by
 * (huntId, token), and performs one fresh detail read per globally unique token.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findMissingGoodTokens, readDetailLive } from "./stage3-replay.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

export function buildClassificationReport(missingGood, detailByToken) {
  const items = missingGood.map((item) => {
    const detail = detailByToken.get(item.token);
    return {
      huntId: item.huntId,
      token: item.token,
      grade: item.grade,
      classification: detail?.classification ?? "unclassified",
      status: detail?.status ?? null,
      sectionsPresent: detail?.sectionsPresent ?? false,
      reason: detail?.reason ?? "detail-read-not-attempted",
      detail: detail?.detail ?? null,
    };
  });
  const live = items.filter((item) => item.classification === "live").length;
  const expired = items.filter((item) => item.classification === "expired").length;
  const unclassified = items.filter((item) => item.classification === "unclassified").length;
  return {
    mode: "post-grade-classification",
    method: "per-hunt (huntId, token) join; grade 1-3 only; one live detail read per globally unique missing token",
    missingGoodTokenCount: missingGood.length,
    uniqueTokenCount: new Set(missingGood.map((item) => item.token)).size,
    detailRequestCount: detailByToken.size,
    liveButMissedCount: live,
    expiredCount: expired,
    unclassifiedCount: unclassified,
    replayIncompleteDueToUnclassifiedDetails: unclassified > 0,
    items,
  };
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function runStage3ClassificationRecovery(options = {}) {
  const outputDir = resolve(options.outputDir ?? join(ROOT, "..", "stage3-replay-output"));
  const poolsByHunt = JSON.parse(await readFile(join(outputDir, "hunt-pools.json"), "utf8"));
  const pools = Object.entries(poolsByHunt).map(([huntId, pool]) => ({
    huntId,
    listings: Array.isArray(pool?.listings) ? pool.listings : [],
  }));
  const grades = options.grades ?? (await import("../src/lib/engine-v2-research/data/stage1-grades-70.json", { with: { type: "json" } })).default.records;
  const missingGood = findMissingGoodTokens(grades, pools);
  const uniqueTokens = [...new Set(missingGood.map((item) => item.token))];
  const state = { lastRequestAt: null, events: [] };
  const detailByToken = new Map();
  const events = [];

  for (const token of uniqueTokens) {
    const result = await readDetailLive(token, state, {
      fetchImpl: options.fetchImpl,
      now: options.now,
      sleep: options.sleep,
      random: options.random,
    });
    detailByToken.set(token, result);
    events.push(...state.events.splice(0));
  }

  const report = buildClassificationReport(missingGood, detailByToken);
  report.generatedAt = new Date().toISOString();
  report.events = events;
  const reportPath = join(outputDir, "missing-good-classification.json");
  const recoveryPath = join(outputDir, "classification-recovery-report.json");
  await writeJson(reportPath, report);
  await writeJson(recoveryPath, {
    generatedAt: report.generatedAt,
    missingGoodTokenCount: report.missingGoodTokenCount,
    uniqueTokenCount: report.uniqueTokenCount,
    detailRequestCount: report.detailRequestCount,
    liveButMissedCount: report.liveButMissedCount,
    expiredCount: report.expiredCount,
    unclassifiedCount: report.unclassifiedCount,
    replayIncompleteDueToUnclassifiedDetails: report.replayIncompleteDueToUnclassifiedDetails,
    output: reportPath,
  });
  return {
    outputDir,
    ...report,
    events: undefined,
    reportPath,
    recoveryPath,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const arg = process.argv[2];
    const outputDir = arg ? (isAbsolute(arg) ? arg : resolve(process.cwd(), arg)) : undefined;
    const summary = await runStage3ClassificationRecovery({ outputDir });
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } catch (error) {
    process.stderr.write("Stage 3 classification recovery failed: " + (error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
