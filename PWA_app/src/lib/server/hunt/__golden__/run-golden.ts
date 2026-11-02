/**
 * HANDOFF-G (2026-11-02) — offline golden evaluation, measurement only.
 *
 * Run from PWA_app with:
 *   npx tsx --tsconfig src/lib/server/hunt/__golden__/tsconfig.json \
 *     src/lib/server/hunt/__golden__/run-golden.ts
 *
 * The __golden__-local tsconfig exists only to alias "server-only" to the
 * package's own empty.js and to resolve the @/ alias under tsx. It changes
 * no production file: pipeline.ts, semantics.ts, interpret.ts,
 * definition.ts and package.json are untouched.
 *
 * Offline mocking without a production change: the runner monkey-patches
 * the exported divarProvider instance (searchLists / getDetail) before
 * each runPipeline call. No network, no LLM. The provider object is a
 * plain class instance (divarClient.ts), not frozen, so assignment works.
 *
 * Modes:
 * - A (main): getDetail returns description = title, categorySlug "".
 * - B (comparison): getDetail returns stale: true, so the pipeline takes
 *   its own "unknown detail" path (description "", detailUnknown true).
 *   That is what "description = unknown (null)" means inside this
 *   pipeline: there is no null-description value, only detailUnknown.
 *
 * Tier reading: from the HANDOFF-T trace returned by runPipeline. An ad
 * with no trace entry was excluded in the title phase (pre-candidate)
 * and is recorded as tier 4 with reason "title-exclude".
 *
 * Special rows (in tables, excluded from all totals): city-filter
 * (hunt 6 rows 1, 4, 5 — the mock applies no city filter) and borderline
 * (rows marked ؟ in LABELS-v2: hunt 3 row 17, hunt 6 row 3, hunt 8 row 2).
 * Hunt 7 uses scenario A grades only.
 *
 * Metric definitions (stated so the numbers are checkable):
 * - leak: owner grade 4, but shown (tier 1-3).
 * - missed: owner grade 1 or 2, but tier 4 or hidden.
 * - grade-3-hidden (HANDOFF-K): owner grade 3, but tier 4 or hidden.
 *   Counted rows only, same convention as leak/missed.
 * - accepted bait (HANDOFF-K): hunt 4 rows 12 and 20. The owner accepts
 *   them as grade 3 (bait accepted), so leak is reported twice: with
 *   them (standard count) and without them (excluding those two rows
 *   from the leak count). JSON grades are untouched.
 * - exact / ±1 agreement: over counted rows WITH a tier number only.
 *   Hidden rows have no tier number, so they are excluded from the
 *   agreement denominator but counted in "missed" when their grade is
 *   1 or 2. Hidden rows are also excluded from the 4x4 matrix.
 * - order: first-5 = owner-grade-1 count among the first 5 shown ads
 *   in pipeline order; inverted pairs = pairs (i<j) in shown order with
 *   grade[i] > grade[j], as a percentage of all shown pairs.
 *
 * No measurement number is asserted anywhere; the only test is the
 * data-sanity test in golden-data.test.ts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { divarProvider } from "../../divar/divarClient";
import { resolveHuntDefinition } from "../definition";
import { runPipeline, type HuntTraceEntry } from "../pipeline";

const HERE = dirname(fileURLToPath(import.meta.url));

interface TitleRow {
  id: string;
  hunt: number;
  row: number;
  title: string;
  price: number;
  city: string;
}

interface HuntLabels {
  hunt: number;
  sentence: string;
  searchQuery: string;
  answer: { transaction?: string; condition?: string };
  grades: Record<string, number>;
  borderlineRows: number[];
  cityFilterRows: number[];
}

interface AdEval {
  id: string;
  hunt: number;
  row: number;
  title: string;
  price: number;
  city: string;
  grade: number;
  special: "city-filter" | "borderline" | null;
  tierA: number | null;
  statusA: string;
  reasonsA: string[];
  tierB: number | null;
  statusB: string;
  reasonsB: string[];
  orderA: number | null;
  orderB: number | null;
}

interface HuntSummary {
  hunt: number;
  counted: number;
  shownA: number;
  tier4A: number;
  hiddenA: number;
  leakA: number;
  missedA: number;
  grade3HiddenA: number;
  leakWithoutBaitA: number;
  exactA: number;
  within1A: number;
  first5Grade1A: number;
  invertedA: number;
  pairsA: number;
  shownB: number;
  tier4B: number;
  hiddenB: number;
  leakB: number;
  missedB: number;
  grade3HiddenB: number;
  leakWithoutBaitB: number;
  exactB: number;
  within1B: number;
  first5Grade1B: number;
  invertedB: number;
  pairsB: number;
  matrixA: number[][];
  matrixB: number[][];
  specialCount: number;
}

// Per-mode summary shapes: sum("A") returns exactly the A shape, sum("B")
// exactly the B shape (the literal argument selects the branch).
interface ModeSummaryA {
  shownA: number;
  tier4A: number;
  hiddenA: number;
  leakA: number;
  missedA: number;
  grade3HiddenA: number;
  leakWithoutBaitA: number;
  exactA: number;
  within1A: number;
  first5Grade1A: number;
  invertedA: number;
  pairsA: number;
  matrixA: number[][];
}

interface ModeSummaryB {
  shownB: number;
  tier4B: number;
  hiddenB: number;
  leakB: number;
  missedB: number;
  grade3HiddenB: number;
  leakWithoutBaitB: number;
  exactB: number;
  within1B: number;
  first5Grade1B: number;
  invertedB: number;
  pairsB: number;
  matrixB: number[][];
}

// HANDOFF-K: accepted-bait rows, keyed "hunt-row". Owner decision: these
// two hunt-4 rows are accepted bait (owner grade 3), so leak is reported
// both with and without them. JSON grades are untouched.
const ACCEPTED_BAIT_ROWS = new Set(["4-12", "4-20"]);

const COACH_EXAMPLES: string[] = [
  "آپارتمان ۸۰ تا ۱۰۰ متری در سعادت‌آباد، آسانسور حتماً، طبقه اول نباشه، تا ۸ میلیارد",
  "لپ‌تاپ گیمینگ، RTX 4060 حتماً، رم ۱۶ گیگ، تا ۸۰ میلیون",
  "آیفون ۱۳، بدون تعمیر، ۱۲۸ گیگ، تا ۵۰ میلیون",
  "آپارتمان ۲ خوابه، آسانسور حتماً، ترجیحاً پارکینگ",
  "پژو ۲۰۷، مدل ۱۴۰۱ به بالا، تهران، تا ۱ میلیارد",
  "یه لپ‌تاپ سبک برای دانشگاه، ۱۴ اینچ، رم حداقل ۱۶، تا ۴۰ میلیون",
];

function esc(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;
}

function tierLabel(tier: number | null, status: string): string {
  if (status === "hidden:dupe") return "hidden:dupe";
  if (status === "hidden:detail-cap") return "hidden:detail-cap";
  return tier === null ? "?" : String(tier);
}

async function evalHunt(
  hunt: HuntLabels,
  ads: TitleRow[],
  mode: "A" | "B"
): Promise<Map<string, { tier: number | null; status: string; reasons: string[]; order: number | null }>> {
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
    if (mode === "B") {
      return {
        sourceAdId: id,
        title: ad.title,
        price: ad.price,
        city: ad.city,
        description: "",
        images: [],
        categorySlug: "",
        stale: true,
      };
    }
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
  const { results, trace } = await runPipeline(def, () => {});
  const traceById = new Map<string, HuntTraceEntry>(
    trace.map((t) => [t.sourceAdId, t])
  );
  const orderById = new Map<string, number>(
    results.map((r, i) => [r.sourceAdId, i])
  );
  const out = new Map<
    string,
    { tier: number | null; status: string; reasons: string[]; order: number | null }
  >();
  for (const ad of ads) {
    const entry = traceById.get(ad.id);
    if (entry) {
      out.set(ad.id, {
        tier: entry.tier ?? null,
        status: entry.status,
        reasons: [...entry.reasons],
        order: orderById.has(ad.id) ? (orderById.get(ad.id) as number) : null,
      });
    } else {
      // Title-phase exclude: never became a candidate, hence no trace.
      out.set(ad.id, {
        tier: 4,
        status: "tier4",
        reasons: ["title-exclude"],
        order: null,
      });
    }
  }
  return out;
}

function summarize(hunt: number, rows: AdEval[]): HuntSummary {
  const counted = rows.filter((r) => r.special === null);
  const sum = (mode: "A" | "B") => {
    const tierKey = mode === "A" ? "tierA" : "tierB";
    const statusKey = mode === "A" ? "statusA" : "statusB";
    const orderKey = mode === "A" ? "orderA" : "orderB";
    const matrix: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    let shown = 0;
    let tier4 = 0;
    let hidden = 0;
    let leak = 0;
    let missed = 0;
    let grade3Hidden = 0;
    let leakWithoutBait = 0;
    let exact = 0;
    let within1 = 0;
    let tiered = 0;
    for (const r of counted) {
      const tier = r[tierKey];
      const status = r[statusKey];
      if (status === "shown") shown += 1;
      else if (status === "tier4") tier4 += 1;
      else hidden += 1;
      if (r.grade === 4 && status === "shown") {
        leak += 1;
        if (!ACCEPTED_BAIT_ROWS.has(`${r.hunt}-${r.row}`)) leakWithoutBait += 1;
      }
      if (
        (r.grade === 1 || r.grade === 2) &&
        (status === "tier4" || status.startsWith("hidden"))
      ) {
        missed += 1;
      }
      if (r.grade === 3 && (status === "tier4" || status.startsWith("hidden"))) {
        grade3Hidden += 1;
      }
      if (tier !== null) {
        tiered += 1;
        matrix[r.grade - 1][tier - 1] += 1;
        if (tier === r.grade) exact += 1;
        if (Math.abs(tier - r.grade) <= 1) within1 += 1;
      }
    }
    const shownOrdered = counted
      .filter((r) => r[statusKey] === "shown" && r[orderKey] !== null)
      .sort((a, b) => (a[orderKey] as number) - (b[orderKey] as number));
    const first5Grade1 = shownOrdered.slice(0, 5).filter((r) => r.grade === 1).length;
    let inverted = 0;
    let pairs = 0;
    for (let i = 0; i < shownOrdered.length; i++) {
      for (let j = i + 1; j < shownOrdered.length; j++) {
        pairs += 1;
        if (shownOrdered[i].grade > shownOrdered[j].grade) inverted += 1;
      }
    }
    if (mode === "A") {
      return {
        shownA: shown,
        tier4A: tier4,
        hiddenA: hidden,
        leakA: leak,
        missedA: missed,
        grade3HiddenA: grade3Hidden,
        leakWithoutBaitA: leakWithoutBait,
        exactA: exact,
        within1A: within1,
        first5Grade1A: first5Grade1,
        invertedA: inverted,
        pairsA: pairs,
        matrixA: matrix,
      };
    }
    return {
      shownB: shown,
      tier4B: tier4,
      hiddenB: hidden,
      leakB: leak,
      missedB: missed,
      grade3HiddenB: grade3Hidden,
      leakWithoutBaitB: leakWithoutBait,
      exactB: exact,
      within1B: within1,
      first5Grade1B: first5Grade1,
      invertedB: inverted,
      pairsB: pairs,
      matrixB: matrix,
    };
  };
  const a = sum("A") as ModeSummaryA;
  const b = sum("B") as ModeSummaryB;
  return {
    hunt,
    counted: counted.length,
    ...a,
    ...b,
    specialCount: rows.length - counted.length,
  };
}

function contractRow(sentence: string, answer?: { transaction?: string; condition?: string }) {
  const def = resolveHuntDefinition({
    query: sentence,
    transaction: answer?.transaction ?? "",
    condition: answer?.condition ?? "",
  });
  if (!def) return `| ${esc(sentence)} | — | — | — | — | — | — | — | — | — | — | — |`;
  const priceHard =
    def.priceMin !== "" || def.priceMax !== ""
      ? "سخت"
      : "—";
  // HANDOFF-N: a city named only inside ترجیحاً domains is preferred.
  const cityHard =
    def.city === "all"
      ? "— (بدون فیلتر شهر)"
      : def.citySource === "preference"
        ? "ترجیحی (preference)"
        : `سخت (${def.citySource ?? "?"})`;
  // HANDOFF-N: anyOf groups leave include, so show them in its cell.
  const includeCell = [
    ...def.include,
    ...(def.includeAnyOf ?? []).map((g) => `یکی‌از: ${g.join(" یا ")}`),
  ].join("، ");
  return `| ${esc(sentence)} | ${esc(includeCell)} | ${esc(def.exclude.join("، "))} | ${esc((def.should ?? []).join("، "))} | ${esc((def.absentAttributes ?? []).join("، "))} | ${def.priceMin || "—"} | ${def.priceMax || "—"} | ${priceHard} | ${def.city} | ${cityHard} | ${def.transaction || "—"} | ${def.condition || "—"} | ${def.category} |`;
}

async function main(): Promise<void> {
  const titles = JSON.parse(
    readFileSync(join(HERE, "golden-titles.json"), "utf-8")
  ) as TitleRow[];
  const labels = JSON.parse(
    readFileSync(join(HERE, "golden-labels.json"), "utf-8")
  ) as { hunts: HuntLabels[] };
  const byHunt = new Map<number, TitleRow[]>();
  for (const t of titles) {
    const list = byHunt.get(t.hunt) ?? [];
    list.push(t);
    byHunt.set(t.hunt, list);
  }

  const allRows: AdEval[] = [];
  const summaries: HuntSummary[] = [];
  for (const hunt of labels.hunts) {
    const ads = (byHunt.get(hunt.hunt) ?? []).sort((a, b) => a.row - b.row);
    const resA = await evalHunt(hunt, ads, "A");
    const resB = await evalHunt(hunt, ads, "B");
    const rows: AdEval[] = ads.map((ad) => {
      const grade = hunt.grades[String(ad.row)];
      const special = hunt.cityFilterRows.includes(ad.row)
        ? ("city-filter" as const)
        : hunt.borderlineRows.includes(ad.row)
          ? ("borderline" as const)
          : null;
      const a = resA.get(ad.id) as { tier: number | null; status: string; reasons: string[]; order: number | null };
      const b = resB.get(ad.id) as { tier: number | null; status: string; reasons: string[]; order: number | null };
      return {
        id: ad.id,
        hunt: ad.hunt,
        row: ad.row,
        title: ad.title,
        price: ad.price,
        city: ad.city,
        grade,
        special,
        tierA: a.tier,
        statusA: a.status,
        reasonsA: a.reasons,
        tierB: b.tier,
        statusB: b.status,
        reasonsB: b.reasons,
        orderA: a.order,
        orderB: b.order,
      };
    });
    allRows.push(...rows);
    summaries.push(summarize(hunt.hunt, rows));
  }

  const counted = allRows.filter((r) => r.special === null);
  const total = (mode: "A" | "B") => {
    const tierKey = mode === "A" ? "tierA" : "tierB";
    const statusKey = mode === "A" ? "statusA" : "statusB";
    const orderKey = mode === "A" ? "orderA" : "orderB";
    const matrix: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    let shown = 0;
    let tier4 = 0;
    let hidden = 0;
    let leak = 0;
    let missed = 0;
    let grade3Hidden = 0;
    let leakWithoutBait = 0;
    let exact = 0;
    let within1 = 0;
    let tiered = 0;
    for (const r of counted) {
      const tier = r[tierKey];
      const status = r[statusKey];
      if (status === "shown") shown += 1;
      else if (status === "tier4") tier4 += 1;
      else hidden += 1;
      if (r.grade === 4 && status === "shown") {
        leak += 1;
        if (!ACCEPTED_BAIT_ROWS.has(`${r.hunt}-${r.row}`)) leakWithoutBait += 1;
      }
      if ((r.grade === 1 || r.grade === 2) && (status === "tier4" || status.startsWith("hidden"))) missed += 1;
      if (r.grade === 3 && (status === "tier4" || status.startsWith("hidden"))) grade3Hidden += 1;
      if (tier !== null) {
        tiered += 1;
        matrix[r.grade - 1][tier - 1] += 1;
        if (tier === r.grade) exact += 1;
        if (Math.abs(tier - r.grade) <= 1) within1 += 1;
      }
    }
    // Order totals: sum per-hunt first-5 counts and inverted pairs.
    let first5 = 0;
    let inverted = 0;
    let pairs = 0;
    for (const s of summaries) {
      if (mode === "A") {
        first5 += s.first5Grade1A;
        inverted += s.invertedA;
        pairs += s.pairsA;
      } else {
        first5 += s.first5Grade1B;
        inverted += s.invertedB;
        pairs += s.pairsB;
      }
    }
    return { shown, tier4, hidden, leak, missed, grade3Hidden, leakWithoutBait, exact, within1, tiered, matrix, first5, inverted, pairs };
  };
  const totalA = total("A");
  const totalB = total("B");
  const specialRows = allRows.filter((r) => r.special !== null);

  const lines: string[] = [];
  lines.push("# GOLDEN — سنجش خودکار روی مجموعه طلایی (۱۰ شکار × ۲۰ عنوان)");
  lines.push("");
  lines.push("سنجش صرف است، نه دروازه: هیچ عددی در این گزارش تست را قرمز نمی‌کند.");
  lines.push("روش: برای هر شکار جمله با resolveHuntDefinition حل شد، پاسخ رفع ابهام با همان مسیر محصول (POST transaction/condition ← HuntDefinition) اعمال شد، سپس pipeline با provider ماک روی ۲۰ آگهی همان شکار اجرا شد.");
  lines.push("حالت A: توضیح = عنوان، categorySlug خالی. حالت B: توضیح نامعلوم — در موتور یعنی getDetail stale، پس detailUnknown و توضیح خالی.");
  lines.push("ردیف از trace مرحله T خوانده شد. آگهی بدون trace در فاز تیتر رد شده است (پیش‌نامزد) و با دلیل title-exclude ردیف ۴ ثبت شد.");
  lines.push("ردیف‌های ویژه در جدول‌ها آمده‌اند ولی در هیچ عدد کل شمرده نشده‌اند: city-filter (شکار ۶ ردیف‌های ۱، ۴، ۵ — ماک فیلتر شهر اعمال نمی‌کند) و borderline (ردیف‌های دارای «؟»: شکار ۳ ردیف ۱۷، شکار ۶ ردیف ۳، شکار ۸ ردیف ۲). شکار ۷ فقط با سناریو الف خوانده شد.");
  lines.push("تعریف‌ها: نشت = نمره مالک ۴ ولی نمایش‌داده‌شده (ردیف ۱ تا ۳). گم‌شده = نمره مالک ۱ یا ۲ ولی ردیف ۴ یا hidden. توافق دقیق و ±۱ فقط روی ردیف‌های دارای عدد ردیف حساب شده‌اند؛ hidden عدد ندارد، پس از مخرج توافق کنار است ولی در گم‌شده (اگر نمره ۱ یا ۲ باشد) شمرده می‌شود. ماتریس هم فقط ردیف‌های دارای عدد را دارد.");
  lines.push("قیمت: سقف/کف قیمت در موتور همیشه فیلتر سخت فاز 3b است (آگهی با قیمت نامعلوم می‌ماند)؛ «ترجیحاً زیر X» از HANDOFF-5 به سقف نرم preferredPriceMax می‌رود و فیلتر سخت نمی‌سازد (فاز 3f هنوز آن را نخوانده است).");
  lines.push("");
  lines.push("## جمع‌بندی کل");
  lines.push("");
  lines.push("| حالت | ردیف‌های شمرده‌شده | نمایش‌داده‌شده | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول (مجموع شکارها) | جفت وارونه |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  lines.push(`| A | ${counted.length} | ${totalA.shown} | ${totalA.tier4} | ${totalA.hidden} | ${totalA.leak} | ${totalA.missed} | ${pct(totalA.exact, totalA.tiered)} (${totalA.exact}/${totalA.tiered}) | ${pct(totalA.within1, totalA.tiered)} (${totalA.within1}/${totalA.tiered}) | ${totalA.first5} | ${pct(totalA.inverted, totalA.pairs)} (${totalA.inverted}/${totalA.pairs}) |`);
  lines.push(`| B | ${counted.length} | ${totalB.shown} | ${totalB.tier4} | ${totalB.hidden} | ${totalB.leak} | ${totalB.missed} | ${pct(totalB.exact, totalB.tiered)} (${totalB.exact}/${totalB.tiered}) | ${pct(totalB.within1, totalB.tiered)} (${totalB.within1}/${totalB.tiered}) | ${totalB.first5} | ${pct(totalB.inverted, totalB.pairs)} (${totalB.inverted}/${totalB.pairs}) |`);
  lines.push("");
  lines.push(`ردیف‌های ویژه (خارج از عددهای کل): ${specialRows.length} عدد — city-filter: ${specialRows.filter((r) => r.special === "city-filter").length}، borderline: ${specialRows.filter((r) => r.special === "borderline").length}.`);
  lines.push("");
  lines.push("## عددهای تازه — HANDOFF-K");
  lines.push("");
  lines.push(`نمره ۳ پنهان‌شده (نمره مالک ۳ ولی ردیف ۴ یا hidden، فقط ردیف‌های شمرده‌شده): حالت A: ${totalA.grade3Hidden}، حالت B: ${totalB.grade3Hidden}.`);
  lines.push(`نشت با طعمه قبول‌شده / بدون آن (شکار ۴ ردیف‌های ۱۲ و ۲۰ طعمه قبول‌شده‌اند، طبق تصمیم مالک ردیف ۳): حالت A: ${totalA.leak} / ${totalA.leakWithoutBait}، حالت B: ${totalB.leak} / ${totalB.leakWithoutBait}.`);
  lines.push("");
  lines.push("یادداشت مالک (HANDOFF-K، اصلاح ۴): نمره ۳ داخل JSON طلایی برای شکار ۷ ردیف‌های ۱ و ۴ قدیمی است — هر دو آگهی فقط‌اجاره‌اند و در شکار خرید همیشه ردیف ۴ می‌شوند (تصمیم مالک: آگهی فقط‌اجاره در شکار خرید همیشه ردیف ۴ است). JSON دست نخورده و این دو ردیف از قانون «هیچ نمره ۱ تا ۳ پایین نرود» مستثنا هستند.");
  lines.push("شکارهای ۵ و ۷ با transaction=buy در اجراکننده اجرا شدند (اصلاح ۳) — همان پاسخ «خرید یا اجاره» در JSON طلایی، بدون تغییر JSON.");
  lines.push("");
  lines.push("### ماتریس کل — حالت A (سطر = نمره مالک، ستون = ردیف موتور)");
  lines.push("");
  lines.push("| نمره مالک \\ ردیف موتور | ۱ | ۲ | ۳ | ۴ |");
  lines.push("|---|---|---|---|---|");
  for (let g = 0; g < 4; g++) {
    lines.push(`| ${g + 1} | ${totalA.matrix[g].join(" | ")} |`);
  }
  lines.push("");
  lines.push("### ماتریس کل — حالت B");
  lines.push("");
  lines.push("| نمره مالک \\ ردیف موتور | ۱ | ۲ | ۳ | ۴ |");
  lines.push("|---|---|---|---|---|");
  for (let g = 0; g < 4; g++) {
    lines.push(`| ${g + 1} | ${totalB.matrix[g].join(" | ")} |`);
  }
  lines.push("");

  for (const s of summaries) {
    const hunt = labels.hunts.find((h) => h.hunt === s.hunt) as HuntLabels;
    const rows = allRows.filter((r) => r.hunt === s.hunt);
    lines.push(`## شکار ${s.hunt}: ${esc(hunt.sentence)}`);
    lines.push("");
    lines.push(`پاسخ رفع ابهام: ${hunt.answer.transaction ? `transaction=${hunt.answer.transaction}` : ""}${hunt.answer.condition ? ` condition=${hunt.answer.condition}` : ""}. پرسمان جذب عنوان: «${esc(hunt.searchQuery)}».`);
    lines.push("");
    lines.push("| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rows) {
      lines.push(`| ${r.row} | ${esc(r.title)} | ${r.price.toLocaleString("en-US")} | ${esc(r.city)} | ${r.grade} | ${r.special ?? "—"} | ${tierLabel(r.tierA, r.statusA)} | ${esc(r.reasonsA.join("، "))} | ${tierLabel(r.tierB, r.statusB)} | ${esc(r.reasonsB.join("، "))} |`);
    }
    lines.push("");
    lines.push("| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
    const tieredA = s.matrixA.flat().reduce((a, b) => a + b, 0);
    const tieredB = s.matrixB.flat().reduce((a, b) => a + b, 0);
    lines.push(`| A | ${s.counted} | ${s.shownA} | ${s.tier4A} | ${s.hiddenA} | ${s.leakA} | ${s.missedA} | ${pct(s.exactA, tieredA)} (${s.exactA}/${tieredA}) | ${pct(s.within1A, tieredA)} (${s.within1A}/${tieredA}) | ${s.first5Grade1A} | ${pct(s.invertedA, s.pairsA)} (${s.invertedA}/${s.pairsA}) |`);
    lines.push(`| B | ${s.counted} | ${s.shownB} | ${s.tier4B} | ${s.hiddenB} | ${s.leakB} | ${s.missedB} | ${pct(s.exactB, tieredB)} (${s.exactB}/${tieredB}) | ${pct(s.within1B, tieredB)} (${s.within1B}/${tieredB}) | ${s.first5Grade1B} | ${pct(s.invertedB, s.pairsB)} (${s.invertedB}/${s.pairsB}) |`);
    lines.push(`نمره ۳ پنهان‌شده: A: ${s.grade3HiddenA}، B: ${s.grade3HiddenB}. نشت بدون طعمه قبول‌شده: A: ${s.leakWithoutBaitA}، B: ${s.leakWithoutBaitB}.`);
    lines.push("");
    lines.push(`ماتریس شکار ${s.hunt} — حالت A (سطر = نمره مالک):`);
    lines.push("");
    for (let g = 0; g < 4; g++) lines.push(`- نمره ${g + 1}: ${s.matrixA[g].join("، ")}`);
    lines.push(`ماتریس شکار ${s.hunt} — حالت B:`);
    lines.push("");
    for (let g = 0; g < 4; g++) lines.push(`- نمره ${g + 1}: ${s.matrixB[g].join("، ")}`);
    lines.push("");
  }

  const leakRows = counted.filter(
    (r) => r.grade === 4 && (r.statusA === "shown" || r.statusB === "shown")
  );
  const missedRows = counted.filter(
    (r) =>
      (r.grade === 1 || r.grade === 2) &&
      (r.statusA === "tier4" ||
        r.statusA.startsWith("hidden") ||
        r.statusB === "tier4" ||
        r.statusB.startsWith("hidden"))
  );
  lines.push("## فهرست کامل نشت‌ها (نمره مالک ۴ ولی نمایش‌داده‌شده)");
  lines.push("");
  if (leakRows.length === 0) lines.push("هیچ.");
  else {
    lines.push("| شکار | ردیف | عنوان | حالت | ردیف موتور | دلیل موتور |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of leakRows) {
      if (r.statusA === "shown") {
        lines.push(`| ${r.hunt} | ${r.row} | ${esc(r.title)} | A | ${tierLabel(r.tierA, r.statusA)} | ${esc(r.reasonsA.join("، "))} |`);
      }
      if (r.statusB === "shown") {
        lines.push(`| ${r.hunt} | ${r.row} | ${esc(r.title)} | B | ${tierLabel(r.tierB, r.statusB)} | ${esc(r.reasonsB.join("، "))} |`);
      }
    }
  }
  lines.push("");
  lines.push("## فهرست کامل گم‌شده‌ها (نمره مالک ۱ یا ۲ ولی ردیف ۴ یا hidden)");
  lines.push("");
  if (missedRows.length === 0) lines.push("هیچ.");
  else {
    lines.push("| شکار | ردیف | عنوان | نمره مالک | حالت | وضعیت موتور | دلیل موتور |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const r of missedRows) {
      const modes: Array<"A" | "B"> = [];
      if (r.statusA === "tier4" || r.statusA.startsWith("hidden")) modes.push("A");
      if (r.statusB === "tier4" || r.statusB.startsWith("hidden")) modes.push("B");
      for (const m of modes) {
        const status = m === "A" ? r.statusA : r.statusB;
        const tier = m === "A" ? r.tierA : r.tierB;
        const reasons = m === "A" ? r.reasonsA : r.reasonsB;
        lines.push(`| ${r.hunt} | ${r.row} | ${esc(r.title)} | ${r.grade} | ${m} | ${tierLabel(tier, status)} | ${esc(reasons.join("، "))} |`);
      }
    }
  }
  lines.push("");
  lines.push("## ردیف‌های ویژه (در عددهای کل نیامده‌اند)");
  lines.push("");
  lines.push("| شکار | ردیف | عنوان | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of specialRows) {
    lines.push(`| ${r.hunt} | ${r.row} | ${esc(r.title)} | ${r.grade} | ${r.special} | ${tierLabel(r.tierA, r.statusA)} | ${esc(r.reasonsA.join("، "))} | ${tierLabel(r.tierB, r.statusB)} | ${esc(r.reasonsB.join("، "))} |`);
  }
  lines.push("");
  lines.push("## فهم جمله — خروجی قرارداد (بدون قبول یا رد)");
  lines.push("");
  lines.push("برای ۱۰ جمله طلایی، قرارداد با همان پاسخ رفع ابهام سنجش ساخته شده است. برای ۶ مثال CoachHint، بدون پاسخ رفع ابهام (خام).");
  lines.push("");
  lines.push("| جمله | include | exclude | should | absentAttributes | قیمت کف | قیمت سقف | نرم/سخت قیمت | شهر | شهر سخت/ترجیح | transaction | condition | دسته |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const hunt of labels.hunts) {
    lines.push(contractRow(hunt.sentence, hunt.answer));
  }
  for (const ex of COACH_EXAMPLES) {
    lines.push(contractRow(ex));
  }
  lines.push("");

  writeFileSync(join(HERE, "golden-report.md"), lines.join("\n"), "utf-8");
  console.log(
    JSON.stringify(
      {
        counted: counted.length,
        special: specialRows.length,
        A: {
          leak: totalA.leak,
          missed: totalA.missed,
          exact: `${totalA.exact}/${totalA.tiered}`,
          within1: `${totalA.within1}/${totalA.tiered}`,
        },
        B: {
          leak: totalB.leak,
          missed: totalB.missed,
          exact: `${totalB.exact}/${totalB.tiered}`,
          within1: `${totalB.within1}/${totalB.tiered}`,
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
