import { NextResponse, type NextRequest } from "next/server";

import { getStore } from "@/lib/server/eval/store";
import { FORBIDDEN_TESTER_KEYS } from "@/lib/server/eval/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ownSession(req: NextRequest, id: string): boolean {
  return req.cookies.get("shakar_eval")?.value === id;
}

/**
 * GET /api/eval/session/[id] — session progress + assigned missions.
 * Blinded: missions carry query/task text only. Listing content is served
 * exclusively by the run endpoint (recorded per run). Never includes
 * reference labels, verdicts, or scores (asserted in tests).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ownSession(req, id)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const store = getStore();
  const session = store.getSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unknown-session" }, { status: 404 });
  }
  const missions = session.missionIds
    .map((mid) => store.getMission(mid))
    .filter((m) => m !== null && m.enabled)
    .map((m) => ({
      id: m!.id,
      query: m!.query,
      taskFa: m!.taskFa,
      maxItems: m!.maxItems,
      response: store.getResponse(id, m!.id)?.status ?? null,
    }));
  const payload = { ok: true, sessionId: id, cohort: session.cohort, status: session.status, missions };
  const leaked = FORBIDDEN_TESTER_KEYS.filter((k) =>
    JSON.stringify(payload).includes(`"${k}"`)
  );
  if (leaked.length > 0) {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  return NextResponse.json(payload);
}
