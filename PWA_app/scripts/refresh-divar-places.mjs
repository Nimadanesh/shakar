#!/usr/bin/env node
// Regenerate src/data/divar-places.ts from Divar's official place catalog.
// One read-only meta request; run manually when the catalog test reports
// drift (new/renamed places). Never run per-hunt or per-request.
const ENDPOINT = "https://api.divar.ir/v8/places/cities";

const res = await fetch(ENDPOINT, {
  method: "GET",
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(30000),
});
if (!res.ok) {
  console.error(`Divar places request failed: HTTP ${res.status}`);
  process.exit(1);
}
const json = await res.json();
const cities = Array.isArray(json?.cities) ? json.cities : null;
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
const header = `// GENERATED from Divar's official place catalog (${ENDPOINT}).
// Do not edit by hand — run \`npm run places:refresh\` to regenerate.
// Generated: ${new Date().toISOString()} — ${places.length} places (all level "place2").
// Each entry keeps the verified Persian label, exact Divar slug, and numeric id.
`;
const body =
  `export interface DivarPlace {\n` +
  `  readonly id: number;\n` +
  `  readonly slug: string;\n` +
  `  readonly name: string;\n` +
  `}\n\n` +
  `export const DIVAR_PLACE_COUNT = ${places.length} as const;\n\n` +
  `export const DIVAR_PLACES: readonly DivarPlace[] = ${JSON.stringify(places)} as const;\n`;
const fs = await import("node:fs");
const path = await import("node:path");
const out = path.join(import.meta.dirname, "..", "src", "data", "divar-places.ts");
fs.writeFileSync(out, header + body, "utf-8");
console.log(`Wrote ${places.length} places to ${out}`);
