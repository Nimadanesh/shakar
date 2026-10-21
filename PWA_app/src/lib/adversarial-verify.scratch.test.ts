/**
 * SCRATCH verifier for the deepseek v4.1 flash adversarial category battery
 * (delegation prompt #3, 2026-10-16 — TOKEN PLAN: mechanical verification here,
 * final judgment stays with musi).
 *
 * Reads PWA_app/adversarial-cases.md, runs every row through the REAL
 * detectCategoryFromText, and fails loudly on any mismatch.
 *
 * - `## sanity` section: 6 already-handled anchors — must keep passing.
 * - `## deepseek` section: paste the 60-row table; empty = skipped, suite green.
 *
 * Temporary by design (`.scratch.`): promote the surviving deepseek cases into
 * the committed battery (cf. interpret.test.ts) once musi reviews them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectCategoryFromText } from "@/lib/interpret";

const CASES_FILE = resolve(process.cwd(), "adversarial-cases.md");

type CaseRow = { query: string; expected: string | null; why: string };

const NULL_TOKENS = new Set([
  "null",
  "none",
  "unknown",
  "n/a",
  "na",
  "-",
  "—",
  "نامشخص",
  "ناشناخته",
  "هیچی",
  "خالی",
  "",
]);

const FA_ALIASES: Record<string, string> = {
  املاک: "real-estate",
  مسکن: "real-estate",
  "real estate": "real-estate",
  خودرو: "vehicles",
  ماشین: "vehicles",
  موبایل: "mobile",
  گوشی: "mobile",
  تلفن: "mobile",
  خانه: "home",
  خانگی: "home",
  "لوازم خانگی": "home",
  سرگرمی: "music",
  تفریح: "music",
  موسیقی: "music",
  "آلات موسیقی": "music",
  شخصی: "personal",
  خدمات: "services",
  شغل: "jobs",
  استخدام: "jobs",
  کاریابی: "jobs",
  صنعتی: "industrial",
  صنعت: "industrial",
};

function normalizeExpected(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (NULL_TOKENS.has(t)) return null;
  if (FA_ALIASES[t]) return FA_ALIASES[t];
  return t || null;
}

function parseSection(md: string, name: string): CaseRow[] {
  const rows: CaseRow[] = [];
  const lines = md.split("\n");
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      inSection = line.trim().toLowerCase() === `## ${name}`;
      continue;
    }
    if (!inSection) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0]) || /^query$/i.test(cells[0])) continue; // header/separator
    if (!cells[0]) continue;
    rows.push({
      query: cells[0],
      expected: normalizeExpected(cells[1] ?? ""),
      why: cells[2] ?? "",
    });
  }
  return rows;
}

function verify(rows: CaseRow[], label: string): string[] {
  const failures: string[] = [];
  for (const [i, row] of rows.entries()) {
    const got = detectCategoryFromText(row.query);
    const ok = got === row.expected;
    const mark = ok ? "✓" : "✗";
    // eslint-disable-next-line no-console
    console.log(
      `${mark} [${label} #${i + 1}] "${row.query}" → expected=${row.expected ?? "null"}, got=${got ?? "null"}` +
        (row.why ? ` — ${row.why}` : ""),
    );
    if (!ok) {
      failures.push(
        `[${label} #${i + 1}] "${row.query}": expected ${row.expected ?? "null"}, got ${got ?? "null"}`,
      );
    }
  }
  return failures;
}

describe("adversarial category verification (scratch)", () => {
  it("sanity anchors + deepseek battery match the real classifier", () => {
    const md = readFileSync(CASES_FILE, "utf-8");
    const sanity = parseSection(md, "sanity");
    const deepseek = parseSection(md, "deepseek");

    expect(
      sanity.length,
      "sanity section must contain the 6 known anchors",
    ).toBe(6);

    // Deliberate product parks (musi triage 2026-10-16) — not bugs:
    // #3 «رهن و اجاره»: «اجاره» is cross-category (cars, tools) — needs real data
    // #20 «شیر آب اهرمی»: «شیر» deliberately absent (lion/milk/faucet/valve)
    // #41 «سرویس کولر گازی»: ambiguous «سرویس» — needs R3/human data
    const PARKED = new Set(["رهن و اجاره", "شیر آب اهرمی", "سرویس کولر گازی"]);

    const failures = verify(sanity, "sanity");
    if (deepseek.length === 0) {
      // eslint-disable-next-line no-console
      console.log("… deepseek section empty — skipping (paste the 60-row table to verify)");
    } else {
      const all = verify(deepseek, "deepseek");
      for (const f of all) {
        const m = f.match(/"([^"]+)"/);
        if (m && PARKED.has(m[1])) {
          // eslint-disable-next-line no-console
          console.log(`⊘ PARKED (deliberate): ${f}`);
        } else {
          failures.push(f);
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `\nsummary: sanity ${sanity.length - failures.filter((f) => f.includes("[sanity")).length}/${sanity.length} ✓, ` +
        `deepseek ${deepseek.length - failures.filter((f) => f.includes("[deepseek")).length}/${deepseek.length} ✓`,
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
