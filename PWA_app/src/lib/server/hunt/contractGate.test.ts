/**
 * Experiment B gate harness (Decision v2 sec.6).
 *
 * TODAY: baseline measurement mode — runs the frozen probe set
 * (~/workspace/your_files/experiment-b-probe-v1.json) through
 * resolveHuntDefinition and prints per-probe flags. When the intent
 * contract layer lands, the same expectations become hard assertions
 * (polarity inversions = 0, invented MUST = 0, caps extracted,
 * collapse rule on structured twins).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveHuntDefinition } from "./definition";
import { normalizeForMatch, tokenize } from "@/lib/persianNormalize";

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
    priceMin?: number;
    city?: string | null;
    direction?: string;
    kind?: string;
  };
  twin?: Record<string, unknown>;
}

const probes: Probe[] = JSON.parse(
  readFileSync(
    "/home/hatch/workspace/your_files/experiment-b-probe-v1.json",
    "utf-8"
  )
).probes;

const norm = (s: string) => normalizeForMatch(s);
const stemsOf = (s: string) =>
  new Set(tokenize(norm(s)).map((t) => t.replace(/‌/g, "")));

function num(s: string): number | null {
  const d = s.replace(/[^0-9]/g, "");
  return d ? Number(d) : null;
}

describe("Experiment B — baseline (measurement only)", () => {
  it("prints the sec.6 baseline for the frozen probe set", () => {
    const lines: string[] = [];
    for (const p of probes) {
      const def = resolveHuntDefinition({ query: p.input });
      if (!def) {
        lines.push(`${p.id} [${p.class}] NULL DEFINITION`);
        continue;
      }
      const inc = def.include ?? [];
      const abs = def.absentAttributes ?? [];
      const exc = def.exclude ?? [];
      const flags: string[] = [];
      // polarity: a mustNot attribute surfacing inside include = inversion
      for (const a of p.expect.mustNot ?? []) {
        const aStems = stemsOf(a);
        const inverted = inc.some((t) =>
          [...stemsOf(t)].some((s) => aStems.has(s))
        );
        if (inverted) flags.push(`INVERTED(${a})`);
        const captured =
          abs.some((x) => norm(x) === norm(a)) ||
          exc.some((x) => norm(x) === norm(a));
        if (!captured && !inverted) flags.push(`ABSENCE-MISSING(${a})`);
      }
      // invented MUST candidates: include terms outside the allowed vocab
      const allowed = new Set<string>();
      for (const s of [
        p.expect.subject ?? "",
        ...(p.expect.must ?? []),
        ...(p.expect.should ?? []),
      ])
        for (const t of stemsOf(s)) allowed.add(t);
      const invented = inc.filter((t) =>
        [...stemsOf(t)].some((s) => !allowed.has(s))
      );
      if (invented.length)
        flags.push(`MUST?(${invented.join(" | ")})`);
      // caps
      if (p.expect.priceMax !== undefined) {
        const got = num(def.priceMax ?? "");
        if (got !== p.expect.priceMax)
          flags.push(`CAP(max exp ${p.expect.priceMax} got ${got})`);
      }
      if (p.expect.city !== undefined && p.expect.city !== null) {
        if (p.expect.city === "تهران" && def.city !== "tehran")
          flags.push(`CITY(exp tehran got ${def.city})`);
      }
      lines.push(
        `${p.id} [${p.class}] ${flags.length ? "FLAGS: " + flags.join(" ") : "clean-ish"}\n` +
          `    inc=[${inc.join("، ")}] abs=[${abs.join("، ")}] exc=[${exc.join("، ")}] should=[${(def.should ?? []).join("، ")}]` +
          ` price=[${def.priceMin}..${def.priceMax}] city=${def.city} svc=${def.serviceIntent ?? false} role=${def.roleMode ?? "-"} dir=${def.direction ?? "-"}`
      );
    }
    // eslint-disable-next-line no-console
    console.log("\n" + lines.join("\n"));
    expect(lines).toHaveLength(probes.length);
  });
});
