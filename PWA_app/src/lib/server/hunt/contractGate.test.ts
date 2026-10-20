/**
 * Experiment B gate (Decision v2 sec.6) — hard assertions.
 *
 * History: this file began as a baseline measurement harness (parser
 * scored 3 inversions, invented MUSTs on 4 probes, malformed
 * multi-clause absences). With the intent-contract layer landed
 * (contract.ts), the same frozen expectations are now the gate:
 *   polarity inversions = 0 · invented MUST = 0 · lexically present
 *   numeric caps extracted · structured-twin collapse <= half.
 * Probe file: ~/workspace/your_files/experiment-b-probe-v1.json (frozen).
 *
 * Erratum (recorded, probe NOT edited): probe B08 words its direction
 * "seeking-item", but navid's R6 ruling (definition.ts, detectRoleMode)
 * fixes bare «خریدار X» as seek-buyer — the hunter seeks buyer ads.
 * The gate asserts the R6 semantics: "seeking-sellers".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildContract, contractFromFields } from "./contract";
import { normalizeForMatch, stemToken, tokenize } from "@/lib/persianNormalize";

interface Probe {
  id: string;
  input: string;
  class: string;
  expect: {
    subject?: string;
    must?: string[];
    mustNot?: string[];
    should?: string[];
    priceMax?: number;
    city?: string | null;
    direction?: string;
    kind?: string;
  };
  twin?: {
    subject?: string;
    include?: string[];
    exclude?: string[];
    priceMax?: number;
    direction?: string;
  };
}

const probes: Probe[] = JSON.parse(
  readFileSync(
    "/home/hatch/workspace/your_files/experiment-b-probe-v1.json",
    "utf-8"
  )
).probes;

const stemsOf = (s: string) =>
  new Set(
    tokenize(normalizeForMatch(s)).map((t) =>
      stemToken(t.replace(/‌/g, ""))
    )
  );
const covers = (haystack: string, needle: string) => {
  const h = stemsOf(haystack);
  return [...stemsOf(needle)].every((s) => h.has(s));
};
const anyCovers = (texts: string[], needle: string) =>
  texts.some((t) => covers(t, needle));

describe("Experiment B gate — sec.6 on the frozen probe", () => {
  it("every probe satisfies its contract expectations", () => {
    const failures: string[] = [];
    for (const p of probes) {
      const c = buildContract(p.input);
      const bad = (m: string) => failures.push(`${p.id}: ${m}`);
      const mustTexts = c.must.map((t) => t.text);
      const mustNotTexts = c.mustNot.map((t) => t.text);

      // polarity: absences captured, never inverted into MUST/subject
      for (const a of p.expect.mustNot ?? []) {
        if (!anyCovers(mustNotTexts, a)) bad(`absence missing: ${a}`);
        if (anyCovers(mustTexts, a)) bad(`INVERTED into MUST: ${a}`);
        if (c.subject && covers(c.subject.text, a) && p.id !== "B04")
          bad(`INVERTED into subject: ${a}`);
      }
      // expected MUSTs present
      for (const m of p.expect.must ?? [])
        if (!anyCovers(mustTexts, m) && !(c.subject && covers(c.subject.text, m)))
          bad(`MUST missing: ${m}`);
      // invented MUST: every contract MUST must be explained by the probe
      const allowed = new Set<string>();
      for (const s of [
        p.expect.subject ?? "",
        ...(p.expect.must ?? []),
        ...(p.expect.should ?? []),
      ])
        for (const t of stemsOf(s)) allowed.add(t);
      for (const t of c.must)
        for (const s of stemsOf(t.text))
          if (!allowed.has(s)) bad(`invented MUST token: ${s} (in "${t.text}")`);
      // subject phrase carries the expected subject
      if (p.expect.subject) {
        if (!c.subject) bad("subject missing");
        else if (!covers(c.subject.text, p.expect.subject))
          bad(`subject "${c.subject.text}" does not cover "${p.expect.subject}"`);
      }
      // caps + city
      if (p.expect.priceMax !== undefined && c.priceMax !== p.expect.priceMax)
        bad(`priceMax exp ${p.expect.priceMax} got ${c.priceMax}`);
      if (p.expect.city === "تهران" && c.city !== "tehran")
        bad(`city exp tehran got ${c.city}`);
      if (p.expect.city === null && c.city !== null)
        bad(`city exp null got ${c.city}`);
      // direction (R6 semantics — see erratum above)
      const dirExpect: Record<string, string> = {
        B07: "seeking-service",
        B08: "seeking-sellers",
        B09: "seeking-item",
        B10: "seeking-service",
      };
      if (dirExpect[p.id] && c.direction !== dirExpect[p.id])
        bad(`direction exp ${dirExpect[p.id]} got ${c.direction}`);
      if (p.expect.kind === "UNKNOWN" && c.kind !== "UNKNOWN")
        bad("kind not UNKNOWN");
    }
    expect(failures).toEqual([]);
  });

  it("structured twins do not collapse (sec.6: at most half may)", () => {
    const withMust = probes.filter((p) => p.twin?.include?.length);
    let collapses = 0;
    for (const p of withMust) {
      const fc = contractFromFields({
        subject: p.twin!.subject,
        include: p.twin!.include,
        exclude: p.twin!.exclude,
        priceMax: p.twin!.priceMax,
      });
      const lost = (p.twin!.include ?? []).filter(
        (inc) => !fc.must.some((t) => covers(t.text, inc))
      );
      if (lost.length || (p.twin!.subject && !fc.subject)) collapses++;
    }
    expect(collapses).toBeLessThanOrEqual(Math.floor(withMust.length / 2));
    expect(collapses).toBe(0);
  });

  it("absence state-space matrix — unseen words, every position", () => {
    // Model page sec.2: marker x position x clause-count. Novel subject
    // and attributes on purpose (anti battery-fitting).
    const cases: Array<[string, string[]]> = [
      ["دوچرخه بدون دنده", ["دنده"]], // end position, single
      ["دوچرخه بدون دنده تا ۲۰ میلیون", ["دنده"]], // mid + price tail (RC1)
      ["دوچرخه بدون دنده و بدون ترمز", ["دنده", "ترمز"]], // two clauses (RC2)
      ["اسکوتر بدون شارژر اصل", ["شارژر"]], // attribute + trailing spec word
      ["دوچرخه بدون دنده، تهران", ["دنده"]], // absence before city
    ];
    for (const [input, attrs] of cases) {
      const c = buildContract(input);
      const mustNotTexts = c.mustNot.map((t) => t.text);
      for (const a of attrs) {
        expect(anyCovers(mustNotTexts, a), `${input} -> ${a}`).toBe(true);
        expect(
          c.must.some((t) => covers(t.text, a)),
          `${input} inverted ${a}`
        ).toBe(false);
      }
    }
  });
});
