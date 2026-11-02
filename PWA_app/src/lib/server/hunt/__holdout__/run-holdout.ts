/**
 * HANDOFF-H (2026-11-02) — one-time offline holdout measurement, read-only.
 *
 * Run from PWA_app with:
 *   npx tsx --tsconfig src/lib/server/hunt/__golden__/tsconfig.json \
 *     src/lib/server/hunt/__holdout__/run-holdout.ts
 *
 * The __golden__ tsconfig is reused only for its aliases (server-only ->
 * the package's own empty.js, @/* -> src/*). No new tsconfig file is
 * created, per the allowed-files list. No engine file, no test file, no
 * __golden__ file and no CI file is changed by this runner.
 *
 * Data: holdout-titles.json / holdout-labels.json, converted verbatim
 * from GOLDEN-HOLDOUT-TITLES.md / GOLDEN-HOLDOUT-LABELS.md (no content
 * change). The پرسمان lines are record-only and never executed; the
 * hunt sentence is the section title. Disambiguation answers, fixed by
 * the handoff: no hunt is real-estate, so transaction is empty and
 * condition is "any" for all 20 hunts (stored per hunt in the labels
 * JSON, applied through the same resolveHuntDefinition call the
 * product uses).
 *
 * Execution mirrors golden mode A exactly: description = title,
 * categorySlug "", mock provider (no city filter, no network, no LLM),
 * tier/status/reasons from the HANDOFF-T trace; an ad with no trace
 * entry was excluded in the title phase and is recorded as tier 4
 * with reason "title-exclude". C rows run through the same pipeline
 * (the mock applies no city filter); their owner grades assume the
 * given city is correct.
 *
 * Counting (handoff definitions, nothing else):
 * - shown = engine tier 1, 2 or 3; removed = tier 4 or hidden (no tier).
 * - leak = owner grade 4 and shown.
 * - missed = owner grade 1, 2 or 3 and removed.
 * - every number is reported twice: (a) without C rows (main),
 *   (b) C rows only.
 * - the 4x4 matrices count only rows with an engine tier number;
 *   hidden rows (no tier number) are excluded from the matrix only,
 *   but counted in removed/missed, as in golden.
 *
 * No analysis, no fix suggestion: this file only measures and lists.
 * If any data-sanity check fails, it stops before any evaluation and
 * writes no report.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { divarProvider } from "../../divar/divarClient";
import { resolveHuntDefinition } from "../definition";
import { runPipeline, type HuntTraceEntry } from "../pipeline";

const HERE = dirname(fileURLToPath(import.meta.url));

// Base commit this runner was built on (HANDOFF-H amendment 1).
const BASE_SHA = "65c75afc70e060f3020e6a741cd6c043d7f76a76";
const EXPECTED_COUNTS = [
  29, 27, 26, 28, 26, 27, 29, 29, 26, 25, 26, 29, 26, 27, 29, 26, 28, 28, 26, 27,
];
const C_HUNTS = new Set([7, 8, 17, 18]);

interface TitleRow {
  id: string;
  hunt: number;
  row: number;
  title: string;
  price: number | null;
  city: string;
}

interface HuntLabels {
  hunt: number;
  sentence: string;
  answer: { transaction?: string; condition?: string };
  grades: Record<string, number>;
  cRows: number[];
}

interface RowEval {
  hunt: number;
  row: number;
  title: string;
  grade: number;
  c: boolean;
  tier: number | null;
  status: string;
  reasons: string[];
}

interface SliceTotals {
  counted: number;
  shown: number;
  removed: number;
  leak: number;
  leakTier1: number;
  missed: number;
  missed1: number;
  missed2: number;
  missed3: number;
  matrix: number[][];
  hidden: number;
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fail(msg: string): never {
  throw new Error(`DATA SANITY FAILED: ${msg}`);
}

function checkData(titles: TitleRow[], labels: { hunts: HuntLabels[] }): void {
  if (titles.length !== 544) fail(`total rows ${titles.length} != 544`);
  const byHunt = new Map<number, TitleRow[]>();
  for (const t of titles) {
    const list = byHunt.get(t.hunt) ?? [];
    list.push(t);
    byHunt.set(t.hunt, list);
  }
  if (labels.hunts.length !== 20) {
    fail(`labels hunts ${labels.hunts.length} != 20`);
  }
  for (const h of labels.hunts) {
    const rows = (byHunt.get(h.hunt) ?? []).map((r) => r.row).sort((a, b) => a - b);
    const expected = Array.from(
      { length: EXPECTED_COUNTS[h.hunt - 1] },
      (_, i) => i + 1
    );
    if (rows.join(",") !== expected.join(",")) {
      fail(`hunt ${h.hunt} rows [${rows}] != 1..${EXPECTED_COUNTS[h.hunt - 1]}`);
    }
    const graded = Object.keys(h.grades).map(Number).sort((a, b) => a - b);
    if (graded.join(",") !== rows.join(",")) {
      fail(`hunt ${h.hunt} graded rows [${graded}] != title rows [${rows}]`);
    }
    for (const [row, grade] of Object.entries(h.grades)) {
      if (grade < 1 || grade > 4) {
        fail(`hunt ${h.hunt} row ${row} grade ${grade} outside 1..4`);
      }
    }
    const rowSet = new Set(rows);
    for (const r of h.cRows) {
      if (!rowSet.has(r)) fail(`hunt ${h.hunt} C row ${r} has no title row`);
    }
    if (h.cRows.length > 0 && !C_HUNTS.has(h.hunt)) {
      fail(`hunt ${h.hunt} has C rows but is not a C hunt`);
    }
  }
}

async function evalHunt(
  hunt: HuntLabels,
  ads: TitleRow[]
): Promise<
  Map<string, { tier: number | null; status: string; reasons: string[] }>
> {
  const def = resolveHuntDefinition({
    query: hunt.sentence,
    transaction: hunt.answer.transaction ?? "",
    condition: hunt.answer.condition ?? "",
  });
  if (!def) throw new Error(`could not resolve hunt ${hunt.hunt}: ${hunt.sentence}`);
  const byId = new Map(ads.map((a) => [a.id, a]));
  const provider = divarProvider as unknown as {
    searchLists: unknown;
    getDetail: unknown;
  };
  provider.searchLists = async () => ({
    listings: ads.map((a) => ({
      sourceAdId: a.id,
      title: a.title,
      price: a.price,
      city: a.city,
    })),
    hasMore: false,
  });
  provider.getDetail = async (id: string) => {
    const ad = byId.get(id);
    if (!ad) throw new Error(`unknown ad ${id}`);
    return {
      sourceAdId: id,
      title: ad.title,
      price: ad.price,
      city: ad.city,
      description: ad.title,
      images: [],
      categorySlug: "",
    };
  };
  const { trace } = await runPipeline(def, () => {});
  const traceById = new Map<string, HuntTraceEntry>(
    trace.map((t) => [t.sourceAdId, t])
  );
  const out = new Map<
    string,
    { tier: number | null; status: string; reasons: string[] }
  >();
  for (const ad of ads) {
    const entry = traceById.get(ad.id);
    if (entry) {
      out.set(ad.id, {
        tier: entry.tier ?? null,
        status: entry.status,
        reasons: [...entry.reasons],
      });
    } else {
      // Title-phase exclude: never became a candidate, hence no trace.
      out.set(ad.id, { tier: 4, status: "tier4", reasons: ["title-exclude"] });
    }
  }
  return out;
}

function summarize(rows: RowEval[]): SliceTotals {
  const matrix: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const t: SliceTotals = {
    counted: rows.length,
    shown: 0,
    removed: 0,
    leak: 0,
    leakTier1: 0,
    missed: 0,
    missed1: 0,
    missed2: 0,
    missed3: 0,
    matrix,
    hidden: 0,
  };
  for (const r of rows) {
    const shown = r.tier === 1 || r.tier === 2 || r.tier === 3;
    if (shown) t.shown += 1;
    else t.removed += 1;
    if (r.tier === null) t.hidden += 1;
    else matrix[r.grade - 1][r.tier - 1] += 1;
    if (r.grade === 4 && shown) {
      t.leak += 1;
      if (r.tier === 1) t.leakTier1 += 1;
    }
    if (r.grade >= 1 && r.grade <= 3 && !shown) {
      t.missed += 1;
      if (r.grade === 1) t.missed1 += 1;
      if (r.grade === 2) t.missed2 += 1;
      if (r.grade === 3) t.missed3 += 1;
    }
  }
  return t;
}

function totalsBlock(label: string, t: SliceTotals): string[] {
  return [
    `### ${label}`,
    "",
    `- شمرده‌شده: ${t.counted}`,
    `- نمایش‌داده‌شده: ${t.shown}`,
    `- حذف‌شده: ${t.removed}`,
    `- نشت: ${t.leak}`,
    `- نشت در ردیف ۱: ${t.leakTier1}`,
    `- گم‌شدن: ${t.missed}`,
    `- گم‌شدن به تفکیک نمره مالک: ۱ ← ${t.missed1}، ۲ ← ${t.missed2}، ۳ ← ${t.missed3}`,
    "",
  ];
}

function matrixBlock(label: string, t: SliceTotals): string[] {
  const lines = [
    `### ${label}`,
    "",
    "| نمره مالک \\ ردیف موتور | ۱ | ۲ | ۳ | ۴ |",
    "|---|---|---|---|---|",
  ];
  for (let g = 0; g < 4; g++) {
    lines.push(
      `| ${g + 1} | ${t.matrix[g][0]} | ${t.matrix[g][1]} | ${t.matrix[g][2]} | ${t.matrix[g][3]} |`
    );
  }
  lines.push("");
  lines.push(
    `ردیف‌های بدون شماره ردیف موتور (hidden) در ماتریس نیستند: ${t.hidden} ردیف.`
  );
  lines.push("");
  return lines;
}

async function main(): Promise<void> {
  const titles = JSON.parse(
    readFileSync(join(HERE, "holdout-titles.json"), "utf-8")
  ) as TitleRow[];
  const labels = JSON.parse(
    readFileSync(join(HERE, "holdout-labels.json"), "utf-8")
  ) as { hunts: HuntLabels[] };
  checkData(titles, labels);
  const byHunt = new Map<number, TitleRow[]>();
  for (const t of titles) {
    const list = byHunt.get(t.hunt) ?? [];
    list.push(t);
    byHunt.set(t.hunt, list);
  }

  const allRows: RowEval[] = [];
  const perHunt: {
    hunt: number;
    sentence: string;
    leakA: number;
    missedA: number;
    leakB: number;
    missedB: number;
    cCount: number;
  }[] = [];
  for (const hunt of labels.hunts) {
    const ads = (byHunt.get(hunt.hunt) ?? []).sort((a, b) => a.row - b.row);
    const res = await evalHunt(hunt, ads);
    const cSet = new Set(hunt.cRows);
    const rows: RowEval[] = ads.map((ad) => {
      const grade = hunt.grades[String(ad.row)];
      const r = res.get(ad.id) as {
        tier: number | null;
        status: string;
        reasons: string[];
      };
      return {
        hunt: ad.hunt,
        row: ad.row,
        title: ad.title,
        grade,
        c: cSet.has(ad.row),
        tier: r.tier,
        status: r.status,
        reasons: r.reasons,
      };
    });
    allRows.push(...rows);
    const shown = (r: RowEval) => r.tier === 1 || r.tier === 2 || r.tier === 3;
    perHunt.push({
      hunt: hunt.hunt,
      sentence: hunt.sentence,
      leakA: rows.filter((r) => !r.c && r.grade === 4 && shown(r)).length,
      missedA: rows.filter((r) => !r.c && r.grade <= 3 && !shown(r)).length,
      leakB: rows.filter((r) => r.c && r.grade === 4 && shown(r)).length,
      missedB: rows.filter((r) => r.c && r.grade <= 3 && !shown(r)).length,
      cCount: hunt.cRows.length,
    });
  }

  const rowsA = allRows.filter((r) => !r.c);
  const rowsB = allRows.filter((r) => r.c);
  const totalA = summarize(rowsA);
  const totalB = summarize(rowsB);
  const leaks = allRows
    .filter((r) => r.grade === 4 && (r.tier === 1 || r.tier === 2 || r.tier === 3))
    .sort((a, b) => a.hunt - b.hunt || a.row - b.row);
  const missed = allRows
    .filter(
      (r) => r.grade <= 3 && !(r.tier === 1 || r.tier === 2 || r.tier === 3)
    )
    .sort((a, b) => a.hunt - b.hunt || a.row - b.row);

  const lines: string[] = [];
  lines.push("# HOLDOUT-REPORT-1 — اندازه‌گیری یک‌باره موتور روی مجموعه بیرونی");
  lines.push("");
  lines.push("## ۱. سرصفحه");
  lines.push("");
  lines.push(`- کامیت پایه: ${BASE_SHA}`);
  lines.push(`- تاریخ: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(
    "- بررسی سلامت داده: گذشت — ۵۴۴ ردیف؛ تعداد هر شکار برابر فهرست مورد انتظار " +
      "(29، 27، 26، 28، 26، 27، 29، 29، 26، 25، 26، 29، 26، 27، 29، 26، 28، 28، 26، 27)؛ " +
      "هر ردیف دقیقاً یک نمره ۱ تا ۴؛ ردیف‌های C فقط در شکارهای ۷، ۸، ۱۷ و ۱۸."
  );
  lines.push("");
  lines.push("## ۲. جمع‌بندی کل");
  lines.push("");
  lines.push(...totalsBlock("(الف) بدون ردیف‌های C — عدد اصلی", totalA));
  lines.push(...totalsBlock("(ب) فقط ردیف‌های C", totalB));
  lines.push("## ۳. ماتریس ۴×۴ (نمره مالک × ردیف موتور)");
  lines.push("");
  lines.push(...matrixBlock("(الف) بدون ردیف‌های C", totalA));
  lines.push(...matrixBlock("(ب) فقط ردیف‌های C", totalB));
  lines.push("## ۴. یک سطر برای هر شکار");
  lines.push("");
  lines.push(
    "| شکار | جمله | نشت (الف) | گم‌شدن (الف) | نشت (ب) | گم‌شدن (ب) | تعداد C |"
  );
  lines.push("|---|---|---|---|---|---|---|");
  for (const p of perHunt) {
    lines.push(
      `| ${p.hunt} | ${esc(p.sentence)} | ${p.leakA} | ${p.missedA} | ${p.leakB} | ${p.missedB} | ${p.cCount} |`
    );
  }
  lines.push("");
  lines.push("## ۵. فهرست کامل نشت‌ها");
  lines.push("");
  lines.push(
    "| شکار | ردیف | تیتر | نمره مالک | ردیف موتور | دلیل موتور | C یا نه |"
  );
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of leaks) {
    lines.push(
      `| ${r.hunt} | ${r.row} | ${esc(r.title)} | ${r.grade} | ${r.tier} | ${esc(r.reasons.join("، "))} | ${r.c ? "بله" : "نه"} |`
    );
  }
  lines.push("");
  lines.push("## ۶. فهرست کامل گم‌شده‌ها");
  lines.push("");
  lines.push(
    "| شکار | ردیف | تیتر | نمره مالک | وضعیت موتور | دلیل موتور | C یا نه |"
  );
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of missed) {
    lines.push(
      `| ${r.hunt} | ${r.row} | ${esc(r.title)} | ${r.grade} | ${r.status} | ${esc(r.reasons.join("، "))} | ${r.c ? "بله" : "نه"} |`
    );
  }
  lines.push("");

  writeFileSync(join(HERE, "holdout-report-1.md"), lines.join("\n"), "utf-8");
  console.log(
    JSON.stringify(
      {
        countedA: totalA.counted,
        countedB: totalB.counted,
        A: {
          shown: totalA.shown,
          removed: totalA.removed,
          leak: totalA.leak,
          leakTier1: totalA.leakTier1,
          missed: totalA.missed,
          missed1: totalA.missed1,
          missed2: totalA.missed2,
          missed3: totalA.missed3,
        },
        B: {
          shown: totalB.shown,
          removed: totalB.removed,
          leak: totalB.leak,
          leakTier1: totalB.leakTier1,
          missed: totalB.missed,
          missed1: totalB.missed1,
          missed2: totalB.missed2,
          missed3: totalB.missed3,
        },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
