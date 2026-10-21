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

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/eval/admin/export?format=json|csv&missionId=&cohort=&status=
 * Full response export. Human judgments only — engine metadata is limited
 * to build/mode identifiers needed for analysis (no hidden mappings exist
 * in storage to leak).
 */
export async function GET(req: Request) {
  const d = denied(req);
  if (d) return d;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const store = getStore();
  const rows = store.queryResponses({
    missionId: url.searchParams.get("missionId") ?? undefined,
    cohort: url.searchParams.get("cohort") ?? undefined,
    status: (url.searchParams.get("status") as "submitted" | null) ?? "submitted",
  });
  if (format === "csv") {
    const lines = [
      "sessionId,cohort,missionId,missionSetVersion,runId,listingId,position,grade,roles,ambiguous,evidenceBasis,reason,submittedAt,revisions",
    ];
    for (const r of rows) {
      const session = store.getSession(r.sessionId);
      for (const it of r.items) {
        lines.push(
          [
            r.sessionId,
            session?.cohort ?? "",
            r.missionId,
            r.missionSetVersion,
            r.runId,
            it.listingId,
            it.position,
            it.grade,
            (it.roles ?? []).join("|"),
            it.ambiguous === true ? "1" : "0",
            it.evidenceBasis ?? "",
            it.reason ?? "",
            r.submittedAt ?? "",
            r.revisions.length,
          ]
            .map(csvCell)
            .join(",")
        );
      }
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shakar-eval-export.csv"',
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json(
    {
      ok: true,
      exportedAt: new Date().toISOString(),
      count: rows.length,
      responses: rows.map((r) => ({
        ...r,
        cohort: store.getSession(r.sessionId)?.cohort ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
