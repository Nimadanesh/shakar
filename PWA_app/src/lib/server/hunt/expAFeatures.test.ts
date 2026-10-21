/**
 * Experiment A harness — feature extraction (Decision v2 sec.2).
 *
 * Computes the 12 frozen features (model page:
 * your_files/experiment-a-model-page.md) for historical graded rows
 * (train) and Snapshot v1 pool rows (snapshot), reusing the production
 * matchers (textMatches, assessAbsencePolarity) — never reimplemented.
 * Features come from the HAND-WRITTEN intended contracts
 * (your_files/intended-contracts-v1.json), never from the free-text
 * parser. Output: ~/workspace/experiment-a/features.json.
 */
import { it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { textMatches } from "@/lib/persianNormalize";
import { assessAbsencePolarity } from "./semantics";

interface Contract {
  n: number;
  subject: string;
  must: string[];
  mustNot: string[];
  expectedKinds: string[];
}
interface AdLike {
  sourceAdId: string;
  title: string;
  descSnippet?: string;
  price?: number | null;
  score?: number;
  matchKind?: string;
  breakdown?: { title?: number; description?: number };
  judgment?: {
    judgment?: { itemKind?: string; violateProbability?: number };
    wouldRejectWrongKind?: boolean;
  } | null;
  poolSide?: string;
}

const contracts: Contract[] = JSON.parse(
  readFileSync("/home/hatch/workspace/your_files/intended-contracts-v1.json", "utf-8")
).hunts;
const byHunt = new Map(contracts.map((c) => [c.n, c]));

const toks = (phrase: string) => phrase.split(" ").filter(Boolean);
function features(c: Contract, ad: AdLike, pool: AdLike[]): number[] {
  const title = ad.title ?? "";
  const desc = ad.descSnippet ?? "";
  const mustToks = [...toks(c.subject), ...c.must.flatMap(toks)];
  const cov = (text: string) =>
    mustToks.length
      ? mustToks.filter((t) => textMatches(text, t)).length / mustToks.length
      : 0;
  const f1 = cov(title);
  const f2 = cov(desc);
  const subjToks = toks(c.subject);
  const f3 = subjToks.every((t) => textMatches(title, t)) ? 1 : 0;
  const scores = pool.map((a) => a.score ?? 0).sort((a, b) => a - b);
  const s = ad.score ?? 0;
  const f4 = scores.length
    ? scores.filter((x) => x < s).length / scores.length
    : 0;
  const f5 = ad.breakdown?.title ?? 0;
  const f6 = ad.breakdown?.description ?? 0;
  const f7 = ad.matchKind === "exact" ? 1 : ad.matchKind === "near" ? 0.5 : 0;
  let f8 = 0;
  if (c.mustNot.length) {
    const map: Record<string, number> = {
      present: -1,
      implied: -0.5,
      unknown: 0,
      absent: 1,
    };
    f8 = Math.min(
      ...c.mustNot.map(
        (a) => map[assessAbsencePolarity(`${title} ${desc}`, a).polarity] ?? 0
      )
    );
  }
  const j = ad.judgment ?? null;
  const kind = j?.judgment?.itemKind;
  const f9 = !j || !kind ? 0 : c.expectedKinds.includes(kind) ? 1 : -1;
  const f10 = j?.wouldRejectWrongKind ? 1 : 0;
  const f11 = j?.judgment?.violateProbability ?? 0;
  const priced = pool
    .map((a) => a.price ?? 0)
    .filter((p) => p > 0)
    .map((p) => Math.log(p))
    .sort((a, b) => a - b);
  const f12 =
    ad.price && ad.price > 0 && priced.length
      ? priced.filter((x) => x < Math.log(ad.price!)).length / priced.length
      : 0.5;
  return [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12];
}

function attachJudgments(d: Record<string, unknown>): Map<string, unknown[]> {
  const stats = (d.stats ?? {}) as { mizanShadow?: unknown[] };
  const m = new Map<string, unknown[]>();
  for (const j of stats.mizanShadow ?? []) {
    const t = (j as { title?: string }).title ?? "";
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push(j);
  }
  return m;
}

const ROUNDS: Array<[string, string, string]> = [
  ["R7", "/home/hatch/workspace/user/files/r7-out/20261018-0024", "/home/hatch/workspace/user/files/r7-grades-4b18ae5-corrected.json"],
  ["R8", "/home/hatch/workspace/r8-laptop-out/r8-laptop-out/20261019-0717", "/home/hatch/workspace/user/files/r8-grades-ceafe05.json"],
  ["R9", "/home/hatch/workspace/r9-laptop-out/20261019-2307", "/home/hatch/workspace/user/files/r9-grades-948a202.json"],
  ["R10", "/home/hatch/workspace/r10-vm-out/20261020-0146", "/home/hatch/workspace/user/files/r9-grades-5a1fc7f.json"],
  ["R11", "/home/hatch/workspace/r11-vm-out", "/home/hatch/workspace/user/files/r11-grades-2f17edc.json"],
];

const readJson = (p: string) =>
  JSON.parse(readFileSync(p, "utf-8").replace(/^﻿/, ""));

/** Mirror of census-extract.py's load_done: VM-era dones are raw SSE
 * streams ("data: {...}" lines); the payload is the type=done event. */
const loadDone = (p: string): Record<string, unknown> | null => {
  let raw: string;
  try {
    raw = readFileSync(p, "utf-8").replace(/^﻿/, "");
  } catch {
    return null;
  }
  if (raw.trimStart().startsWith("data:")) {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (d.type === "done") return d;
      } catch {
        continue;
      }
    }
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

it("extracts Experiment A features", () => {
  const train: unknown[] = [];
  for (const [round, doneDir, gradesPath] of ROUNDS) {
    const grades = readJson(gradesPath).hunts as Array<{
      n: number;
      grades: (number | null)[];
    }>;
    for (const h of grades) {
      const g = h.grades ?? [];
      if (g.length !== 10 || g.some((x) => x === null)) continue;
      const d = loadDone(`${doneDir}/done-${h.n}.json`);
      if (!d) continue;
      const results = (d.results ?? []) as AdLike[];
      if (results.length < 10) continue;
      const top = results.slice(0, 10);
      if (new Set(top.map((r) => r.sourceAdId)).size !== 10) continue;
      const jm = attachJudgments(d);
      const used = new Map<string, number>();
      for (let i = 0; i < 10; i++) {
        const ad = top[i];
        const q = jm.get(ad.title) ?? [];
        const k = used.get(ad.title) ?? 0;
        const judgment = k < q.length ? (q[k] as AdLike["judgment"]) : null;
        used.set(ad.title, k + 1);
        train.push({
          hunt: h.n,
          adId: ad.sourceAdId,
          round,
          grade: g[i],
          title: ad.title,
          f: features(byHunt.get(h.n)!, { ...ad, judgment }, results),
        });
      }
    }
  }
  const pools = readJson(
    "/home/hatch/workspace/snapshot-v1/pools-full.json"
  ) as Record<string, AdLike[]>;
  const snapshot: unknown[] = [];
  for (const [hn, ads] of Object.entries(pools)) {
    const n = Number(hn);
    for (const ad of ads)
      snapshot.push({
        hunt: n,
        adId: ad.sourceAdId,
        poolSide: ad.poolSide ?? "S",
        title: ad.title,
        price: ad.price ?? null,
        f: features(byHunt.get(n)!, ad, ads),
      });
  }
  mkdirSync("/home/hatch/workspace/experiment-a", { recursive: true });
  writeFileSync(
    "/home/hatch/workspace/experiment-a/features.json",
    JSON.stringify({ train, snapshot }),
    "utf-8"
  );
  // eslint-disable-next-line no-console
  console.log(
    `\nfeatures: train rows ${(train as unknown[]).length} | snapshot rows ${snapshot.length}`
  );
});
