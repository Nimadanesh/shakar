import { NextResponse } from "next/server";

import {
  adminTokenConfigured,
  devBootstrapAllowed,
  isAdminAuthorized,
} from "@/lib/server/eval/admin";
import { getStore } from "@/lib/server/eval/store";
import {
  hashInvitationCode,
  invitationExpiry,
  mintInvitationCode,
} from "@/lib/server/eval/tokens";

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
 * POST /api/eval/admin/invitations — mint an invitation code.
 * Body: { cohort, missionIds?, maxUses?, daysValid? }.
 * The plaintext code is returned ONCE and never stored (sha256 only).
 */
export async function POST(req: Request) {
  const d = denied(req);
  if (d) return d;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const store = getStore();
  const cohort = typeof body.cohort === "string" && body.cohort.trim() !== "" ? body.cohort.trim().slice(0, 60) : "default";
  const all = store.listMissions().filter((m) => m.enabled).map((m) => m.id);
  const missionIds = Array.isArray(body.missionIds)
    ? body.missionIds.filter((m): m is string => typeof m === "string" && all.includes(m))
    : all;
  if (missionIds.length === 0) {
    return NextResponse.json({ ok: false, error: "no-missions" }, { status: 400 });
  }
  const maxUses =
    typeof body.maxUses === "number" && Number.isInteger(body.maxUses)
      ? Math.min(Math.max(body.maxUses, 1), 1000)
      : 50;
  const days =
    typeof body.daysValid === "number" && Number.isFinite(body.daysValid)
      ? Math.min(Math.max(body.daysValid, 1), 365)
      : 30;
  const code = mintInvitationCode();
  const now = new Date().toISOString();
  const inv = store.createInvitation({
    id: hashInvitationCode(code),
    cohort,
    missionIds,
    missionSetVersion: 1,
    maxUses,
    uses: 0,
    expiresAt: invitationExpiry(days),
    revoked: false,
    createdAt: now,
  });
  return NextResponse.json({
    ok: true,
    code,
    invitation: { cohort: inv.cohort, missionIds: inv.missionIds, maxUses, expiresAt: inv.expiresAt },
  });
}

/**
 * POST /api/eval/admin/dev-mint — development-only bootstrap: mints one
 * invitation without an admin token so the flow can be exercised locally.
 * Production builds always refuse (mirrors the OTP dev-bypass contract).
 */
export async function PUT(req: Request) {
  if (!devBootstrapAllowed()) {
    return NextResponse.json({ ok: false, error: "not-available" }, { status: 404 });
  }
  void req;
  const store = getStore();
  const all = store.listMissions().filter((m) => m.enabled).map((m) => m.id);
  const code = mintInvitationCode();
  store.createInvitation({
    id: hashInvitationCode(code),
    cohort: "dev",
    missionIds: all,
    missionSetVersion: 1,
    maxUses: 100,
    uses: 0,
    expiresAt: invitationExpiry(7),
    revoked: false,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, code, note: "development-only invitation" });
}
