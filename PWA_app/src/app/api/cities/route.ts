import "server-only";

import { NextResponse } from "next/server";
import { getAllCities } from "@/lib/server/divar/taxonomy";

/**
 * GET /api/cities — the full Divar city directory as [{ slug, name }].
 * Public data, no auth. Served from the server's 24h taxonomy cache
 * (the same fetch resolveCityId uses); clients may cache it briefly.
 *
 * Added 2026-10-09: the Bonab incident — the picker only offered ~90
 * cities, so users hacked missing cities in as «باید» chips, which
 * starves retrieval instead of scoping it. The picker now offers all
 * 1177 Divar cities.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const cities = await getAllCities();
    return NextResponse.json(
      { ok: true, data: cities },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (e) {
    console.warn("[cities]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
