import { NextResponse, type NextRequest } from "next/server";

import { getStore } from "@/lib/server/eval/store";
import type {
  EvidenceBasis,
  ItemJudgment,
  ListingRoleTag,
  MissionOutcome,
  RelevanceGrade,
} from "@/lib/server/eval/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ownSession(req: NextRequest, id: string): boolean {
  return req.cookies.get("shakar_eval")?.value === id;
}

const GRADES: RelevanceGrade[] = [3, 2, 1, 0, "insufficient"];
const ROLES: ListingRoleTag[] = ["seller", "service", "buyer", "rental", "exchange", "unclear"];
const EASE: Array<NonNullable<MissionOutcome["ease"]>> = ["easy", "ok", "hard"];
const FOUND: Array<NonNullable<MissionOutcome["foundWhatWasAsked"]>> = ["yes", "partially", "no"];
const YN: Array<"yes" | "no"> = ["yes", "no"];

function cleanItem(raw: unknown, position: number): ItemJudgment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.listingId !== "string" || r.listingId.trim() === "" || r.listingId.length > 120) {
    return null;
  }
  if (!GRADES.includes(r.grade as RelevanceGrade)) return null;
  const roles = Array.isArray(r.roles)
    ? [...new Set(r.roles.filter((x): x is ListingRoleTag => ROLES.includes(x as ListingRoleTag)))]
    : [];
  const out: ItemJudgment = {
    listingId: r.listingId.trim(),
    position,
    grade: r.grade as RelevanceGrade,
  };
  if (typeof r.reason === "string" && r.reason.trim() !== "") {
    out.reason = r.reason.trim().slice(0, 1000);
  }
  if (r.ambiguous === true) out.ambiguous = true;
  if (r.evidenceBasis === "title" || r.evidenceBasis === "description" || r.evidenceBasis === "both") {
    out.evidenceBasis = r.evidenceBasis as EvidenceBasis;
  }
  if (roles.length > 0) out.roles = roles;
  return out;
}

function cleanOutcome(raw: unknown): MissionOutcome {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: MissionOutcome = {};
  if (FOUND.includes(r.foundWhatWasAsked as never)) {
    out.foundWhatWasAsked = r.foundWhatWasAsked as MissionOutcome["foundWhatWasAsked"];
  }
  if (YN.includes(r.missingUseful as never)) out.missingUseful = r.missingUseful as "yes" | "no";
  if (YN.includes(r.irrelevantInTheWay as never)) {
    out.irrelevantInTheWay = r.irrelevantInTheWay as "yes" | "no";
  }
  if (EASE.includes(r.ease as never)) out.ease = r.ease as MissionOutcome["ease"];
  if (typeof r.note === "string" && r.note.trim() !== "") {
    out.note = r.note.trim().slice(0, 1000);
  }
  return out;
}

/**
 * POST /api/eval/session/[id]/submit — save a draft or finalize a mission
 * response. Body: { missionId, runId, items[], outcome?, draft?: boolean }.
 * Server-side validation: grades from the fixed set, listingIds restricted
 * to the run's displayed order, item count bounded by it. One document per
 * (session, mission); final submit is idempotent and explicit resubmits
 * append an auditable revision instead of overwriting history.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ownSession(req, id)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const missionId = typeof body.missionId === "string" ? body.missionId : "";
  const runId = typeof body.runId === "string" ? body.runId : "";
  const store = getStore();
  const session = store.getSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unknown-session" }, { status: 404 });
  }
  if (!session.missionIds.includes(missionId)) {
    return NextResponse.json({ ok: false, error: "mission-not-assigned" }, { status: 403 });
  }
  const run = store.runsBySession(id).find((r) => r.id === runId && r.missionId === missionId);
  if (!run) {
    return NextResponse.json({ ok: false, error: "unknown-run" }, { status: 404 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "missing-items" }, { status: 400 });
  }
  const shown = new Set(run.listingOrder);
  const items: ItemJudgment[] = [];
  for (const raw of body.items as unknown[]) {
    const cleaned = cleanItem(raw, items.length + 1);
    if (!cleaned) {
      return NextResponse.json({ ok: false, error: "invalid-item" }, { status: 400 });
    }
    if (!shown.has(cleaned.listingId) || items.some((x) => x.listingId === cleaned.listingId)) {
      return NextResponse.json({ ok: false, error: "unknown-listing" }, { status: 400 });
    }
    items.push(cleaned);
  }
  // Partial annotation is allowed (manageable limit): at least one item,
  // at most the displayed set.
  if (items.length === 0 || items.length > run.listingOrder.length) {
    return NextResponse.json({ ok: false, error: "item-count" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const doc = {
    id: store.newId("resp"),
    sessionId: id,
    missionId,
    missionSetVersion: session.missionSetVersion,
    runId: run.id,
    items,
    outcome: cleanOutcome(body.outcome),
    status: "draft" as const,
    submittedAt: null as string | null,
    revisions: [] as Array<{ at: string; note?: string }>,
    createdAt: now,
    updatedAt: now,
  };
  if (body.draft === true) {
    const saved = store.saveDraft(doc);
    return NextResponse.json({ ok: true, status: saved.status, responseId: saved.id });
  }
  const saved = store.submitResponse(doc);
  const remaining = session.missionIds.filter(
    (m) => store.getResponse(id, m)?.status === "submitted"
  );
  if (remaining.length === session.missionIds.length) store.touchSession(id, "completed");
  else store.touchSession(id);
  return NextResponse.json({
    ok: true,
    status: saved.status,
    responseId: saved.id,
    revisions: saved.revisions.length,
  });
}
