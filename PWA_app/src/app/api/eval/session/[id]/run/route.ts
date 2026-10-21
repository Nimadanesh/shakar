import { NextResponse, type NextRequest } from "next/server";

import { getStore } from "@/lib/server/eval/store";
import { FORBIDDEN_TESTER_KEYS } from "@/lib/server/eval/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ownSession(req: NextRequest, id: string): boolean {
  return req.cookies.get("shakar_eval")?.value === id;
}

function engineBuildId(): string {
  return (
    process.env.EVAL_ENGINE_BUILD_ID?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "dev-unrecorded"
  );
}

function liveAllowed(): boolean {
  return process.env.EVAL_ALLOW_LIVE === "1";
}

/**
 * POST /api/eval/session/[id]/run { missionId } — start (or resume) a
 * mission run. Serves listing content and records exactly what was shown:
 * engine/build id, mode (replay|live), result-set id, and display order.
 * Never includes verdicts, scores, or reference labels.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ownSession(req, id)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let missionId = "";
  try {
    const body = (await req.json()) as { missionId?: unknown };
    if (typeof body.missionId === "string") missionId = body.missionId;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const store = getStore();
  const session = store.getSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unknown-session" }, { status: 404 });
  }
  if (!session.missionIds.includes(missionId)) {
    return NextResponse.json({ ok: false, error: "mission-not-assigned" }, { status: 403 });
  }
  const mission = store.getMission(missionId);
  if (!mission || !mission.enabled) {
    return NextResponse.json({ ok: false, error: "mission-unavailable" }, { status: 404 });
  }

  // Resume: an existing run for the latest response attempt is reused so a
  // refresh never silently re-rolls the shown set.
  const existing = store
    .runsBySession(id)
    .filter((r) => r.missionId === missionId)
    .at(-1);
  if (existing) {
    const items = await itemsForRun(store, existing.resultSetId, existing.mode, mission.maxItems);
    if (items) {
      return blinded(existing, items, mission.query, mission.taskFa);
    }
  }

  if (mission.resultSetId) {
    const rs = store.getResultSet(mission.resultSetId);
    if (!rs) {
      return NextResponse.json({ ok: false, error: "resultset-missing" }, { status: 500 });
    }
    const run = store.createRun({
      id: store.newId("run"),
      sessionId: id,
      missionId,
      missionSetVersion: session.missionSetVersion,
      engineBuildId: engineBuildId(),
      mode: "replay",
      resultSetId: rs.id,
      listingOrder: rs.records.slice(0, mission.maxItems).map((r) => r.listingId),
      startedAt: new Date().toISOString(),
    });
    const items = await itemsForRun(store, rs.id, "replay", mission.maxItems);
    return blinded(run, items ?? [], mission.query, mission.taskFa);
  }

  if (mission.liveAllowed && liveAllowed()) {
    const { resolveHuntDefinition } = await import("@/lib/server/hunt/definition");
    const { runPipeline } = await import("@/lib/server/hunt/pipeline");
    const def = resolveHuntDefinition({
      query: mission.query,
      include: [],
      exclude: [],
      city: "all",
      category: "all",
      priceMin: "",
      priceMax: "",
      transaction: "",
      condition: "",
    });
    if (!def) {
      return NextResponse.json({ ok: false, error: "unresolvable-mission" }, { status: 500 });
    }
    const { results, stats } = await runPipeline(def, () => {});
    const top = results.slice(0, mission.maxItems);
    const run = store.createRun({
      id: store.newId("run"),
      sessionId: id,
      missionId,
      missionSetVersion: session.missionSetVersion,
      engineBuildId: engineBuildId(),
      mode: "live",
      resultSetId: null,
      listingOrder: top.map((r) => r.sourceAdId),
      startedAt: new Date().toISOString(),
    });
    const items = top.map((r, i) => ({
      listingId: r.sourceAdId,
      position: i + 1,
      title: r.title,
      description: "",
      price: r.price,
      city: r.city,
      district: "",
    }));
    void stats;
    return blinded(run, items, mission.query, mission.taskFa);
  }

  return NextResponse.json({ ok: false, error: "no-result-source" }, { status: 503 });
}

async function itemsForRun(
  store: ReturnType<typeof getStore>,
  resultSetId: string | null,
  mode: "replay" | "live",
  maxItems: number
): Promise<
  Array<{
    listingId: string;
    position: number;
    title: string;
    description: string;
    price: number | null;
    city: string;
    district: string;
  }> | null
> {
  if (mode !== "replay" || !resultSetId) return null;
  const rs = store.getResultSet(resultSetId);
  if (!rs) return null;
  return rs.records.slice(0, maxItems).map((r, i) => ({
    listingId: r.listingId,
    position: i + 1,
    title: r.title,
    description: r.description,
    price: r.price,
    city: r.city,
    district: r.district,
  }));
}

function blinded(
  run: {
    id: string;
    mode: "replay" | "live";
    engineBuildId: string;
    resultSetId: string | null;
  },
  items: Array<{
    listingId: string;
    position: number;
    title: string;
    description: string;
    price: number | null;
    city: string;
    district: string;
  }>,
  query: string,
  taskFa: string
) {
  const payload = {
    ok: true,
    runId: run.id,
    mode: run.mode,
    engineBuildId: run.engineBuildId,
    resultSetId: run.resultSetId,
    query,
    taskFa,
    items,
  };
  const leaked = FORBIDDEN_TESTER_KEYS.filter((k) =>
    JSON.stringify(payload).includes(`"${k}"`)
  );
  if (leaked.length > 0) {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  return NextResponse.json(payload);
}
