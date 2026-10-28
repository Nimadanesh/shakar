#!/usr/bin/env node
/**
 * Print frozen per-hunt BM25 title rankings as JSON: { huntId: [token, ...] }.
 * Run from PWA_app with Node 24+:
 *   node --experimental-strip-types scripts/stage4a-bm25-rankings.mjs
 * Imports the same Stage 4a module and Stage 2 canonicalizer; no second
 * BM25 implementation exists in this CLI.
 */
import frozenHunts from "../src/lib/engine-v2-research/data/frozen-70-hunts.json" with { type: "json" };
import frozenTitles from "../src/lib/engine-v2-research/data/frozen-pool-titles.json" with { type: "json" };
import { rankFrozenTitlesByHunt } from "../src/lib/engine-v2-research/stage4a-ranking.ts";

const rankings = rankFrozenTitlesByHunt(frozenHunts.hunts, frozenTitles.ads);
process.stdout.write(JSON.stringify(rankings, null, 2) + "\n");
