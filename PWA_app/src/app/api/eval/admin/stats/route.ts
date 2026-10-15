import { NextResponse } from "next/server";

import { adminTokenConfigured, isAdminAuthorized } from "@/lib/server/eval/admin";
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
 * GET /api/eval/admin/stats — private dashboard aggregates.
 * Reports counts, completion, and grade distributions with sample sizes.
 * No "winner" conclusions: insufficient-evidence stays distinct from 0.
 */
export async function GET(req: Request) {
  const d = denied(req);
  if (d) return d;
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId") ?? undefined;
  const cohort = url.searchParams.get("cohort") ?? undefined;
  const store = getStore();
  const sessions = store
    .listSessions()
    .filter((s) => !cohort || s.cohort === cohort);
  const responses = store.queryResponses({ missionId, cohort });
  const submitted = responses.filter((r) => r.status === "submitted");
  const grades: Record<string, number> = {};
  const byMission: Record<
    string,
    { submitted: number; drafts: number; grades: Record<string, number> }
  > = {};
  for (const r of responses) {
    const slot = (byMission[r.missionId] ??= { submitted: 0, drafts: 0, grades: {} });
    if (r.status === "submitted") slot.submitted += 1;
    else slot.drafts += 1;
    for (const it of r.items) {
      const g = String(it.grade) as string;
      grades[g] = (grades[g] ?? 0) + 1;
      slot.grades[g] = (slot.grades[g] ?? 0) + 1;
    }
  }
  return NextResponse.json(
    {
      ok: true,
      participants: new Set(sessions.map((s) => s.participantId)).size,
      sessionsStarted: sessions.length,
      sessionsCompleted: sessions.filter((s) => s.status === "completed").length,
      responsesSubmitted: submitted.length,
      responsesDraft: responses.length - submitted.length,
      grades,
      byMission,
      invitations: store.listInvitations().map((i) => ({
        cohort: i.cohort,
        missionIds: i.missionIds,
        maxUses: i.maxUses,
        uses: i.uses,
        revoked: i.revoked,
        expiresAt: i.expiresAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
