/**
 * HANDOFF-0 — golden guard: the G set is locked in CI.
 *
 * Any later engine change that, on the golden set in mode A,
 * - downgrades a counted owner-grade 1-3 row (rank order
 *   1 < 2 < 3 < 4 < hidden),
 * - turns a baseline tier-4/hidden grade-4 row into a shown row
 *   (a new leak), or
 * - raises total leak, tier-1 leak or tier-2 leak above the locked
 *   baseline,
 * fails this test. Improvements never fail it; they are reported by
 * exactly one summary line, «بهبود: N ردیف».
 *
 * Offline, no network, writes no file: the live test reads
 * golden-titles.json, golden-labels.json and golden-baseline.json and
 * runs the same mode-A evaluation as run-golden.ts (importing it runs
 * nothing — its main() is guarded to direct execution). The baseline
 * is updated only by update-golden-baseline.ts, only when the owner
 * explicitly orders it.
 *
 * Special rows (city-filter, borderline) are never measured.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { evalHunt, type HuntLabels, type TitleRow } from "./run-golden";

const HERE = dirname(fileURLToPath(import.meta.url));

// Owner decision, golden-report.md (HANDOFF-K amendment 4): hunt 7 rows
// 1 and 4 carry a stale grade 3 (rent-only ads, always tier 4 in a buy
// hunt) and are exempt from the no-downgrade rule. They stay in the
// baseline rows, but rule (a) skips them.
const EXEMPT_DOWNGRADE_ROWS = new Set(["7-1", "7-4"]);

interface GuardRow {
  hunt: number;
  row: number;
  grade: number;
  special: "city-filter" | "borderline" | null;
  tier: number | null;
  status: string;
  title: string;
}

interface BaselineRow {
  hunt: number;
  row: number;
  grade: number;
  special: "city-filter" | "borderline" | null;
  tier: number | null;
  status: string;
}

interface BaselineSummary {
  leak: number;
  leakTier1: number;
  leakTier2: number;
}

interface GuardResult {
  regressions: string[];
  improvements: number;
}

function rankOf(row: { tier: number | null }): number {
  return row.tier === null ? 5 : row.tier;
}

function tierLabel(row: { tier: number | null; status: string }): string {
  return row.tier === null ? row.status : String(row.tier);
}

function rowMessage(
  kind: string,
  row: GuardRow,
  base: BaselineRow
): string {
  return (
    `${kind}: شکار ${row.hunt} ردیف ${row.row} «${row.title}» ` +
    `نمره مالک ${row.grade}: خط‌مبنا ${tierLabel(base)} ← فعلی ${tierLabel(row)}`
  );
}

/** Pure comparison: no IO, no pipeline, no clock. */
export function compareGuard(
  baseline: BaselineRow[],
  current: GuardRow[],
  caps: BaselineSummary
): GuardResult {
  const byKey = new Map(current.map((r) => [`${r.hunt}-${r.row}`, r]));
  const regressions: string[] = [];
  let improvements = 0;
  const counted = baseline.filter((r) => r.special === null);
  for (const base of counted) {
    const cur = byKey.get(`${base.hunt}-${base.row}`);
    if (!cur) continue;
    if (base.grade >= 1 && base.grade <= 3) {
      if (EXEMPT_DOWNGRADE_ROWS.has(`${base.hunt}-${base.row}`)) continue;
      if (rankOf(cur) > rankOf(base)) {
        regressions.push(rowMessage("پسرفت", cur, base));
      } else if (rankOf(cur) < rankOf(base)) {
        improvements += 1;
      }
    } else if (base.grade === 4 && rankOf(base) >= 4) {
      if (rankOf(cur) <= 3) {
        regressions.push(rowMessage("نشت تازه", cur, base));
      }
    }
  }
  const shown = (r: GuardRow) =>
    r.tier === 1 || r.tier === 2 || r.tier === 3;
  const curCounted = current.filter((r) => r.special === null);
  const leak = curCounted.filter((r) => r.grade === 4 && shown(r)).length;
  const leakTier1 = curCounted.filter(
    (r) => r.grade === 4 && r.tier === 1
  ).length;
  const leakTier2 = curCounted.filter(
    (r) => r.grade === 4 && r.tier === 2
  ).length;
  if (leak > caps.leak) {
    regressions.push(`نشت کل: خط‌مبنا ${caps.leak} ← فعلی ${leak}`);
  }
  if (leakTier1 > caps.leakTier1) {
    regressions.push(
      `نشت ردیف ۱: خط‌مبنا ${caps.leakTier1} ← فعلی ${leakTier1}`
    );
  }
  if (leakTier2 > caps.leakTier2) {
    regressions.push(
      `نشت ردیف ۲: خط‌مبنا ${caps.leakTier2} ← فعلی ${leakTier2}`
    );
  }
  return { regressions, improvements };
}

const CAPS: BaselineSummary = { leak: 10, leakTier1: 1, leakTier2: 0 };

function fakeRow(
  hunt: number,
  row: number,
  grade: number,
  tier: number | null,
  special: "city-filter" | "borderline" | null = null
): GuardRow {
  return {
    hunt,
    row,
    grade,
    special,
    tier,
    status: tier === null ? "hidden:dupe" : "tier4",
    title: `تیتر ساختگی ${hunt}-${row}`,
  };
}

function fakeBase(
  hunt: number,
  row: number,
  grade: number,
  tier: number | null,
  special: "city-filter" | "borderline" | null = null
): BaselineRow {
  return {
    hunt,
    row,
    grade,
    special,
    tier,
    status: tier === null ? "hidden:dupe" : "tier4",
  };
}

describe("golden guard comparison (pure)", () => {
  it("grade-2 row 3 → 4 is a regression", () => {
    const result = compareGuard(
      [fakeBase(1, 1, 2, 3)],
      [fakeRow(1, 1, 2, 4)],
      CAPS
    );
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]).toContain("شکار 1 ردیف 1");
    expect(result.regressions[0]).toContain("خط‌مبنا 3 ← فعلی 4");
    expect(result.improvements).toBe(0);
  });

  it("grade-4 row 4 → 3 is a regression (new leak)", () => {
    const result = compareGuard(
      [fakeBase(1, 1, 4, 4)],
      [fakeRow(1, 1, 4, 3)],
      CAPS
    );
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]).toContain("نشت تازه");
    expect(result.regressions[0]).toContain("خط‌مبنا 4 ← فعلی 3");
  });

  it("grade-1 row 3 → 1 is an improvement, not a regression", () => {
    const result = compareGuard(
      [fakeBase(1, 1, 1, 3)],
      [fakeRow(1, 1, 1, 1)],
      CAPS
    );
    expect(result.regressions).toHaveLength(0);
    expect(result.improvements).toBe(1);
  });

  it("a special row changing is ignored", () => {
    const result = compareGuard(
      [fakeBase(6, 1, 1, 1, "city-filter")],
      [fakeRow(6, 1, 1, 4, "city-filter")],
      CAPS
    );
    expect(result.regressions).toHaveLength(0);
    expect(result.improvements).toBe(0);
  });

  it("leak 10 → 11 is a regression", () => {
    const baseline: BaselineRow[] = [];
    const current: GuardRow[] = [];
    for (let row = 1; row <= 10; row++) {
      baseline.push(fakeBase(1, row, 4, 3));
      current.push(fakeRow(1, row, 4, 3));
    }
    baseline.push(fakeBase(1, 11, 4, 4));
    current.push(fakeRow(1, 11, 4, 3));
    const result = compareGuard(baseline, current, CAPS);
    expect(result.regressions).toHaveLength(2);
    expect(
      result.regressions.some((m) => m.includes("نشت کل"))
    ).toBe(true);
    expect(
      result.regressions.some((m) => m.includes("نشت تازه"))
    ).toBe(true);
  });
});

describe("golden guard (live mode A)", () => {
  it(
    "no counted row downgrades, no new leak, totals within baseline",
    async () => {
      const titles = JSON.parse(
        readFileSync(join(HERE, "golden-titles.json"), "utf-8")
      ) as TitleRow[];
      const labels = JSON.parse(
        readFileSync(join(HERE, "golden-labels.json"), "utf-8")
      ) as { hunts: HuntLabels[] };
      const baseline = JSON.parse(
        readFileSync(join(HERE, "golden-baseline.json"), "utf-8")
      ) as { summary: BaselineSummary; rows: BaselineRow[] };
      const byHunt = new Map<number, TitleRow[]>();
      for (const t of titles) {
        const list = byHunt.get(t.hunt) ?? [];
        list.push(t);
        byHunt.set(t.hunt, list);
      }
      const current: GuardRow[] = [];
      for (const hunt of labels.hunts) {
        const ads = (byHunt.get(hunt.hunt) ?? []).sort(
          (a, b) => a.row - b.row
        );
        const res = await evalHunt(hunt, ads, "A");
        for (const ad of ads) {
          const grade = hunt.grades[String(ad.row)];
          const special = hunt.cityFilterRows.includes(ad.row)
            ? ("city-filter" as const)
            : hunt.borderlineRows.includes(ad.row)
              ? ("borderline" as const)
              : null;
          const r = res.get(ad.id) as {
            tier: number | null;
            status: string;
            reasons: string[];
          };
          current.push({
            hunt: ad.hunt,
            row: ad.row,
            grade,
            special,
            tier: r.tier,
            status: r.status,
            title: ad.title,
          });
        }
      }
      const { regressions, improvements } = compareGuard(
        baseline.rows,
        current,
        baseline.summary
      );
      console.log(`بهبود: ${improvements} ردیف`);
      if (regressions.length > 0) {
        throw new Error(regressions.join("\n"));
      }
    },
    60000
  );
});
