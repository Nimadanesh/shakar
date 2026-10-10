#!/usr/bin/env node
// Regenerate src/data/divar-places.ts from Divar's official place sources:
// - https://api.divar.ir/v8/places/cities (1,177 selectable places)
// - https://map.divarcdn.com/places-web.json (province hierarchy: type-1
//   provinces group type-2 places; type-4 districts are NOT selectable)
// One read-only request per source; run manually when the catalog test
// reports drift. Never run per-hunt or per-request.
const CITIES_ENDPOINT = "https://api.divar.ir/v8/places/cities";
const HIERARCHY_ENDPOINT = "https://map.divarcdn.com/places-web.json";

async function getJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    console.error(`Request failed: ${url} → HTTP ${res.status}`);
    process.exit(1);
  }
  return res.json();
}

const citiesJson = await getJson(CITIES_ENDPOINT);
const cities = Array.isArray(citiesJson?.cities) ? citiesJson.cities : null;
if (!cities) {
  console.error("Unexpected response shape: missing .cities array");
  process.exit(1);
}
const seen = new Set();
const places = [];
for (const c of cities) {
  if (typeof c?.id !== "number" || typeof c?.slug !== "string" || c.slug === "") {
    console.error(`Skipping entry with missing id/slug: ${JSON.stringify(c)?.slice(0, 120)}`);
    continue;
  }
  if (typeof c?.name !== "string" || c.name.trim() === "") {
    console.error(`Skipping entry with missing name: slug=${c.slug}`);
    continue;
  }
  if (seen.has(c.slug)) {
    console.error(`Duplicate slug in official response: ${c.slug} (keeping first)`);
    continue;
  }
  seen.add(c.slug);
  places.push({ id: c.id, slug: c.slug, name: c.name });
}

const hierarchy = await getJson(HIERARCHY_ENDPOINT);
if (!Array.isArray(hierarchy)) {
  console.error("Unexpected hierarchy shape: root is not an array");
  process.exit(1);
}
const byId = new Map(hierarchy.map((n) => [n.id, n]));
const provinces = [];
const placeProvince = {};
let warnings = 0;
for (const p of places) {
  const node = hierarchy.find((n) => n.slug === p.slug && String(n.type) === "2");
  if (!node) {
    console.error(`No hierarchy node for catalog slug: ${p.slug}`);
    warnings++;
    continue;
  }
  const parent = byId.get(node.parent);
  if (!parent || String(parent.type) !== "1") {
    console.error(`Invalid province parent for ${p.slug}: parent=${node.parent}`);
    warnings++;
    continue;
  }
  placeProvince[p.slug] = parent.slug;
}
for (const n of hierarchy) {
  if (String(n.type) === "1" && n.parent === 715) {
    provinces.push({ id: n.id, slug: n.slug, name: n.name });
  }
}
const header = `// GENERATED from Divar's official place sources:
// - ${CITIES_ENDPOINT}
// - ${HIERARCHY_ENDPOINT} (province hierarchy: type-1 groups type-2 places)
// Do not edit by hand — run \`npm run places:refresh\` to regenerate.
// Generated: ${new Date().toISOString()} — ${places.length} places (all level "place2"),
// ${provinces.length} provinces, ${Object.keys(placeProvince).length} place→province assignments.
`;
const body =
  `export interface DivarPlace {\n` +
  `  readonly id: number;\n` +
  `  readonly slug: string;\n` +
  `  readonly name: string;\n` +
  `}\n\n` +
  `export interface DivarProvince {\n` +
  `  readonly id: number;\n` +
  `  readonly slug: string;\n` +
  `  readonly name: string;\n` +
  `}\n\n` +
  `export const DIVAR_PLACE_COUNT = ${places.length} as const;\n\n` +
  `export const DIVAR_PLACES: readonly DivarPlace[] = ${JSON.stringify(places)} as const;\n\n` +
  `export const DIVAR_PROVINCES: readonly DivarProvince[] = ${JSON.stringify(provinces)} as const;\n\n` +
  `/** Canonical place slug → province slug. Places missing here are unclassified (see UI safety net). */\n` +
  `export const DIVAR_PLACE_PROVINCE: Readonly<Record<string, string>> = ${JSON.stringify(placeProvince)};\n`;
const fs = await import("node:fs");
const path = await import("node:path");
const out = path.join(import.meta.dirname, "..", "src", "data", "divar-places.ts");
fs.writeFileSync(out, header + body, "utf-8");
console.log(`Wrote ${places.length} places, ${provinces.length} provinces, ${Object.keys(placeProvince).length} assignments to ${out} (${warnings} warnings)`);
