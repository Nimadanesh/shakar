#!/usr/bin/env node
/**
 * Refresh the reproducible Stage 3 Divar city-ID snapshot.
 * Run from PWA_app: node scripts/fetch-stage3-divar-cities.mjs
 * This script uses plain Node fetch and does not import server-side code.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SOURCE = "https://api.divar.ir/v8/places/cities";
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/engine-v2-research/divar-cities.json");

const response = await fetch(SOURCE, {
  method: "GET",
  headers: { accept: "application/json", "user-agent": "Shekaar-Stage3-CitySnapshot/1.0" },
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`Divar city request failed: HTTP ${response.status}`);

const payload = await response.json();
if (!payload || !Array.isArray(payload.cities)) {
  throw new Error("Unexpected Divar city response: expected { cities: [...] }");
}

const cities = {};
for (const city of payload.cities) {
  if (!city || typeof city.slug !== "string" || !city.slug || !Number.isSafeInteger(city.id) || city.id < 0) {
    throw new Error("Unexpected city entry; refusing to write a partial snapshot");
  }
  if (Object.hasOwn(cities, city.slug)) throw new Error(`Duplicate Divar city slug: ${city.slug}`);
  cities[city.slug] = String(city.id);
}
if (Object.keys(cities).length < 1000 || cities.tehran !== "1" || cities.karaj !== "2") {
  throw new Error(`City snapshot validation failed (count=${Object.keys(cities).length}, tehran=${cities.tehran}, karaj=${cities.karaj}); refusing to overwrite the frozen file`);
}

const snapshot = {
  source: SOURCE,
  fetchedAt: new Date().toISOString().slice(0, 10),
  cities: Object.fromEntries(Object.entries(cities).sort(([a], [b]) => a.localeCompare(b))),
};
await writeFile(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
process.stdout.write(`Wrote ${Object.keys(cities).length} Divar city IDs to ${OUTPUT} (fetchedAt ${snapshot.fetchedAt})\n`);
