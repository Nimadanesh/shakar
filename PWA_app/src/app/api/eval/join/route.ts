import { NextResponse } from "next/server";

import { getStore } from "@/lib/server/eval/store";
import {
  hashInvitationCode,
  mintParticipantId,
} from "@/lib/server/eval/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/eval/join { code } — redeem an invitation code.
 * Consumes one use, creates an anonymous session, and sets the session
 * cookie. The code itself is never stored or returned.
 */
export async function POST(req: Request) {
  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code.trim();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  if (code === "") {
    return NextResponse.json({ ok: false, error: "missing-code" }, { status: 400 });
  }
  const store = getStore();
  const id = hashInvitationCode(code);
  const inv = store.consumeInvitation(id);
  if (!inv) {
    return NextResponse.json({ ok: false, error: "invalid-code" }, { status: 403 });
  }
  const now = new Date().toISOString();
  const session = store.createSession({
    id: store.newId("sess"),
    participantId: mintParticipantId(),
    invitationId: inv.id,
    cohort: inv.cohort,
    missionIds: inv.missionIds.filter((m) => store.getMission(m)?.enabled !== false),
    missionSetVersion: inv.missionSetVersion,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const res = NextResponse.json({
    ok: true,
    sessionId: session.id,
    missions: session.missionIds,
  });
  res.cookies.set("shakar_eval", session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
