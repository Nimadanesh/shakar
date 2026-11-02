/**
 * HANDOFF-0 — regenerate golden-baseline.json from a live mode-A run.
 *
 * Run from PWA_app ONLY when the owner explicitly orders a baseline
 * update (a HANDOFF from navid, never on a schedule, never from a
 * test):
 *   npx tsx --tsconfig src/lib/server/hunt/__golden__/tsconfig.json \
 *     src/lib/server/hunt/__golden__/update-golden-baseline.ts
 *
 * The guard test (golden-guard.test.ts) never writes files; it only
 * reads the baseline this script produces. Importing run-golden.ts
 * here runs nothing (its main() is guarded to direct execution).
 *
 * The baseline stores, for every golden row, the owner grade, the
 * special flag (city-filter / borderline / null) and the mode-A engine
 * tier (or the hidden status when there is no tier number), plus the
 * counted-row summary the guard caps against.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ACCEPTED_BAIT_ROWS,
  evalHunt,
  type HuntLabels,
  type TitleRow,
} from "./run-golden";

const HERE = dirname(fileURLToPath(import.meta.url));

interface BaselineRow {
  hunt: number;
  row: number;
  grade: number;
  special: "city-filter" | "borderline" | null;
  tier: number | null;
  status: string;
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

  const rows: BaselineRow[] = [];
  for (const hunt of labels.hunts) {
    const ads = (byHunt.get(hunt.hunt) ?? []).sort((a, b) => a.row - b.row);
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
      rows.push({
        hunt: ad.hunt,
        row: ad.row,
        grade,
        special,
        tier: r.tier,
        status: r.status,
      });
    }
  }

  const counted = rows.filter((r) => r.special === null);
  const shown = (r: BaselineRow) =>
    r.tier === 1 || r.tier === 2 || r.tier === 3;
  const removed = (r: BaselineRow) => !shown(r);
  const summary = {
    counted: counted.length,
    grade4Count: counted.filter((r) => r.grade === 4).length,
    leak: counted.filter((r) => r.grade === 4 && shown(r)).length,
    leakTier1: counted.filter((r) => r.grade === 4 && r.tier === 1).length,
    leakTier2: counted.filter((r) => r.grade === 4 && r.tier === 2).length,
    leakWithoutBait: counted.filter(
      (r) =>
        r.grade === 4 &&
        shown(r) &&
        !ACCEPTED_BAIT_ROWS.has(`${r.hunt}-${r.row}`)
    ).length,
    missed: counted.filter(
      (r) => (r.grade === 1 || r.grade === 2) && removed(r)
    ).length,
    missed1: counted.filter((r) => r.grade === 1 && removed(r)).length,
    missed2: counted.filter((r) => r.grade === 2 && removed(r)).length,
    grade3Hidden: counted.filter((r) => r.grade === 3 && removed(r)).length,
  };
  const baseline = { mode: "A", summary, rows };
  writeFileSync(
    join(HERE, "golden-baseline.json"),
    JSON.stringify(baseline, null, 2) + "\n",
    "utf-8"
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
