import { NextResponse } from "next/server";

import { isAdminAuthorized, adminTokenConfigured } from "@/lib/server/eval/admin";
import { validateMissionDefinition } from "@/lib/server/eval/missions";
import { getStore } from "@/lib/server/eval/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function denied(req: Request): NextResponse | null {
  if (!adminTokenConfigured()) {
    return NextResponse.json({ ok: false, error: "admin-not-configured" }, { status: 503 });
  }
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET /api/eval/admin/missions — versioned mission set (no hidden labels exist to leak). */
export async function GET(req: Request) {
  const d = denied(req);
  if (d) return d;
  return NextResponse.json({ ok: true, missions: getStore().listMissions() });
}

/** POST /api/eval/admin/missions — create or update one mission definition. */
export async function POST(req: Request) {
  const d = denied(req);
  if (d) return d;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const m = validateMissionDefinition(body);
  if (!m) {
    return NextResponse.json({ ok: false, error: "invalid-mission" }, { status: 400 });
  }
  if (m.resultSetId && !getStore().getResultSet(m.resultSetId)) {
    return NextResponse.json({ ok: false, error: "unknown-resultset" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, mission: getStore().upsertMission(m) });
}
