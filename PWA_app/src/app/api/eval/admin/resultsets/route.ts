import { NextResponse } from "next/server";

import { adminTokenConfigured, isAdminAuthorized } from "@/lib/server/eval/admin";
import { validateResultSet } from "@/lib/server/eval/snapshots";
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

/**
 * POST /api/eval/admin/resultsets { query, records[] } — validate and store
 * a redacted replay snapshot. Rejected inputs return field-level issues;
 * nothing is stored until validation passes.
 */
export async function POST(req: Request) {
  const d = denied(req);
  if (d) return d;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const checked = validateResultSet(body);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, error: "invalid-snapshot", issues: checked.issues }, { status: 400 });
  }
  const store = getStore();
  const now = new Date().toISOString();
  const rs = store.putResultSet({
    id: store.newId("rs"),
    version: 1,
    createdAt: now,
    query: checked.value.query,
    records: checked.value.records,
  });
  return NextResponse.json({
    ok: true,
    resultSet: { id: rs.id, query: rs.query, records: rs.records.length },
  });
}

/** GET /api/eval/admin/resultsets — inventory (counts only, no content). */
export async function GET(req: Request) {
  const d = denied(req);
  if (d) return d;
  void req;
  return NextResponse.json({ ok: true, resultSets: getStore().listResultSets() });
}
