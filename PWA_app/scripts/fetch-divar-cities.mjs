#!/usr/bin/env node
/**
 * One-off generator: fetches Divar's full city directory and writes
 * src/lib/divarCities.ts (committed — client-side text detection and the
 * city pickers work offline from this file).
 *
 * Run: node scripts/fetch-divar-cities.mjs
 * (calls https://api.divar.ir/v8/places/cities exactly once)
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.divar.ir/v8/places/cities";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "divarCities.ts");

/** 31 provincial capitals — always listed first, in this fixed order. */
const CAPITALS = [
  "tehran", "mashhad", "isfahan", "karaj", "shiraz", "tabriz", "ahvaz",
  "qom", "kermanshah", "urmia", "rasht", "zahedan", "hamadan", "kerman",
  "yazd", "ardabil", "bandar-abbas", "arak", "zanjan", "qazvin", "sanandaj",
  "khorramabad", "gorgan", "sari", "bushehr", "birjand", "ilam",
  "shahrekord", "yasuj", "semnan", "bojnurd",
];

/**
 * Extra name aliases for text detection (space/ZWNJ variants users type).
 * Keyed by Divar slug; merged with the API's canonical name.
 */
const ALIASES = {
  "urmia": ["اورمیه"],
  "bandar-abbas": ["بندر عباس"],
  "khorramabad": ["خرم آباد"],
  "najafabad": ["نجف آباد"],
  "khomeyni-shahr": ["خمینی شهر"],
  "shahin-shahr": ["شاهین شهر"],
  "bandar-anzali": ["بندر انزلی"],
  "shahriar-city": ["شهریار"],
  "pakdasht-city": ["پاکدشت"],
};

const res = await fetch(API, { headers: { "User-Agent": "Mozilla/5.0" } });
if (!res.ok) throw new Error(`cities API: HTTP ${res.status}`);
const json = await res.json();
const raw = Array.isArray(json?.cities) ? json.cities : [];
const seen = new Set();
const entries = [];
for (const c of raw) {
  if (typeof c?.slug !== "string" || typeof c?.name !== "string") continue;
  if (seen.has(c.slug)) continue;
  seen.add(c.slug);
  const names = [c.name, ...(ALIASES[c.slug] ?? [])].filter(
    (n, i, a) => n && a.indexOf(n) === i
  );
  entries.push({ id: c.slug, names });
}

// Short names (≤2 chars) are text-detection hazards — print for review.
const short = entries.filter((e) => e.names.some((n) => n.length <= 2));
if (short.length > 0) {
  console.warn(
    "SHORT NAMES (review for false positives):",
    short.map((e) => `${e.id}=${e.names.join("/")}`).join(", ")
  );
}

const capSet = new Set(CAPITALS);
const caps = [];
const rest = [];
for (const e of entries) (capSet.has(e.id) ? caps : rest).push(e);
caps.sort((a, b) => CAPITALS.indexOf(a.id) - CAPITALS.indexOf(b.id));
rest.sort((a, b) => a.names[0].localeCompare(b.names[0], "fa"));
const ordered = [...caps, ...rest];

const lines = [
  "/**",
  " * GENERATED FILE — do not edit by hand.",
  " * Regenerate: node scripts/fetch-divar-cities.mjs",
  ` * Source: Divar /v8/places/cities (${entries.length} cities).`,
  " *",
  " * The full Divar city directory: powers text city detection",
  " * (interpret.ts KNOWN_CITIES) and the client city pickers",
  " * (src/data/taxonomy.ts CITIES). Committed so both work offline.",
  " * Order: 31 provincial capitals first, then Persian alphabetical.",
  " */",
  "",
  "export interface DivarCityEntry {",
  "  /** Divar slug — the stable id used everywhere (resolveCityId, pickers). */",
  "  id: string;",
  "  /** Canonical Persian name first, then accepted aliases. */",
  "  names: string[];",
  "}",
  "",
  `export const DIVAR_CITIES: DivarCityEntry[] = [`,
  ...ordered.map(
    (e) =>
      `  { id: ${JSON.stringify(e.id)}, names: [${e.names.map((n) => JSON.stringify(n)).join(", ")}] },`
  ),
  "];",
  "",
];
writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${OUT} (${ordered.length} cities)`);
