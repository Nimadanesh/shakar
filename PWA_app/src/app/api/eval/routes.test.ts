import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { FORBIDDEN_TESTER_KEYS } from "@/lib/server/eval/types";
import { getStore, resetStoreForTests } from "@/lib/server/eval/store";
import { hashInvitationCode } from "@/lib/server/eval/tokens";
import { POST as joinPost } from "@/app/api/eval/join/route";

vi.mock("@/lib/server/divar/divarClient", () => ({
  divarProvider: {
    name: "divar-first-party",
    searchLists: vi.fn(),
    getDetail: vi.fn(),
  },
}));

import { divarProvider } from "@/lib/server/divar/divarClient";
import { GET as sessionGet } from "@/app/api/eval/session/[id]/route";
import { POST as runPost } from "@/app/api/eval/session/[id]/run/route";
import { POST as submitPost } from "@/app/api/eval/session/[id]/submit/route";
import { GET as missionsGet, POST as missionsPost } from "@/app/api/eval/admin/missions/route";
import { POST as invitationsPost, PUT as devMint } from "@/app/api/eval/admin/invitations/route";
import { GET as exportGet } from "@/app/api/eval/admin/export/route";
import { GET as statsGet } from "@/app/api/eval/admin/stats/route";
import { GET as resultsetsGet, POST as resultsetsPost } from "@/app/api/eval/admin/resultsets/route";

const ADMIN = "test-admin-token";

function post(path: string, body: unknown, cookie?: string): NextRequest {
  return new NextRequest(`http://test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie: `shakar_eval=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(path: string, opts?: { cookie?: string; admin?: boolean }): NextRequest {
  const headers: Record<string, string> = {};
  if (opts?.cookie) headers.cookie = `shakar_eval=${opts.cookie}`;
  if (opts?.admin) headers.authorization = `Bearer ${ADMIN}`;
  return new NextRequest(`http://test${path}`, { headers });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.stubEnv("EVAL_DATA_DIR", mkdtempSync(join(tmpdir(), "eval-routes-")));
  vi.stubEnv("EVAL_ADMIN_TOKEN", ADMIN);
  delete process.env.EVAL_ALLOW_LIVE;
  resetStoreForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetStoreForTests();
});

async function adminMint(cohort = "t1"): Promise<string> {
  const res = await invitationsPost(
    new NextRequest("http://test/api/eval/admin/invitations", {
      method: "POST",
      headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
      body: JSON.stringify({ cohort }),
    })
  );
  const body = (await res.json()) as { ok: boolean; code?: string };
  expect(body.ok).toBe(true);
  return body.code as string;
}

async function joinAs(code: string): Promise<{ sessionId: string; cookie: string }> {
  const res = await joinPost(post("/api/eval/join", { code }));
  const body = (await res.json()) as { ok: boolean; sessionId?: string };
  expect(body.ok).toBe(true);
  const sessionId = body.sessionId as string;
  return { sessionId, cookie: sessionId };
}

describe("invitation access", () => {
  it("rejects missing, wrong, exhausted, and revoked codes", async () => {
    expect(((await (await joinPost(post("/api/eval/join", {}))).json()) as { ok: boolean }).ok).toBe(false);
    const bad = await joinPost(post("/api/eval/join", { code: "ev_nope" }));
    expect(bad.status).toBe(403);
    const code = await adminMint("t-revoke");
    const store = getStore();
    const id = hashInvitationCode(code);
    expect(store.revokeInvitation(id)).toBe(true);
    const revoked = await joinPost(post("/api/eval/join", { code }));
    expect(revoked.status).toBe(403);
  });

  it("enforces maxUses", async () => {
    const res = await invitationsPost(
      new NextRequest("http://test/api/eval/admin/invitations", {
        method: "POST",
        headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
        body: JSON.stringify({ cohort: "once", maxUses: 1 }),
      })
    );
    const { code } = (await res.json()) as { code: string };
    expect((await (await joinPost(post("/api/eval/join", { code }))).json()) as { ok: boolean }).toBeTruthy();
    const second = await joinPost(post("/api/eval/join", { code }));
    expect(second.status).toBe(403);
  });

  it("never stores the plaintext code", async () => {
    const code = await adminMint("t-secret");
    const blob = JSON.stringify(getStore().listInvitations());
    expect(blob).not.toContain(code.slice(4, 16));
  });

  it("dev bootstrap is unavailable outside development", async () => {
    const res = await devMint(get("/api/eval/admin/dev-mint"));
    expect(res.status).toBe(404);
  });
});

describe("admin authorization", () => {
  it("returns 503 when unconfigured and 401 on wrong token", async () => {
    vi.stubEnv("EVAL_ADMIN_TOKEN", "");
    resetStoreForTests();
    const res = await missionsGet(get("/api/eval/admin/missions", { admin: true }));
    expect(res.status).toBe(503);
    vi.stubEnv("EVAL_ADMIN_TOKEN", ADMIN);
    resetStoreForTests();
    const bad = await missionsGet(
      new NextRequest("http://test/api/eval/admin/missions", {
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(bad.status).toBe(401);
    const none = await missionsGet(get("/api/eval/admin/missions"));
    expect(none.status).toBe(401);
  });

  it("lists seeded missions and validates new ones", async () => {
    const list = (await (await missionsGet(get("/api/eval/admin/missions", { admin: true }))).json()) as {
      missions: Array<{ id: string }>;
    };
    expect(list.missions.map((m) => m.id)).toContain("m-fridge");
    const bad = await missionsPost(
      new NextRequest("http://test/api/eval/admin/missions", {
        method: "POST",
        headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
        body: JSON.stringify({ id: "BAD", query: "" }),
      })
    );
    expect(bad.status).toBe(400);
    const created = (await (
      await missionsPost(
        new NextRequest("http://test/api/eval/admin/missions", {
          method: "POST",
          headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
          body: JSON.stringify({ id: "m-extra", query: "مبل راحتی" }),
        })
      )
    ).json()) as { ok: boolean };
    expect(created.ok).toBe(true);
  });
});

describe("session isolation and blinded payloads", () => {
  it("requires the session cookie and hides other participants", async () => {
    const code = await adminMint("t-iso");
    const a = await joinAs(code);
    const noCookie = await sessionGet(get(`/api/eval/session/${a.sessionId}`), params(a.sessionId));
    expect(noCookie.status).toBe(401);
    const wrong = await sessionGet(
      get(`/api/eval/session/${a.sessionId}`, { cookie: "sess_other" }),
      params(a.sessionId)
    );
    expect(wrong.status).toBe(401);
    const ok = (await (
      await sessionGet(get(`/api/eval/session/${a.sessionId}`, { cookie: a.cookie }), params(a.sessionId))
    ).json()) as { ok: boolean; missions: unknown[] };
    expect(ok.ok).toBe(true);
    expect(ok.missions.length).toBeGreaterThan(0);
    const leaked = FORBIDDEN_TESTER_KEYS.filter((k) => JSON.stringify(ok).includes(`"${k}"`));
    expect(leaked).toEqual([]);
  });
});

describe("replay run + submit + resume", () => {
  const SNAP = {
    query: "یخچال",
    records: [
      { listingId: "l1", title: "یخچال سالم", description: "تمیز", price: 100, city: "تهران", district: "" },
      { listingId: "l2", title: "فریزر صندوقی", description: "مغازه", price: null, city: "", district: "" },
    ],
  };

  async function setupReplay(): Promise<{ sessionId: string; cookie: string; missionId: string }> {
    const store = getStore();
    const rs = store.putResultSet({
      id: store.newId("rs"),
      version: 1,
      createdAt: new Date().toISOString(),
      query: "یخچال",
      records: SNAP.records,
    });
    store.upsertMission({
      id: "m-replay",
      version: 1,
      enabled: true,
      query: "یخچال",
      taskFa: "یخچال پیدا کنید.",
      maxItems: 12,
      resultSetId: rs.id,
      liveAllowed: false,
    });
    const code = await adminMint("t-replay");
    // Replace the minted mission subset with our mission via a second code path:
    const inv = store.listInvitations().at(-1);
    if (inv) {
      inv.missionIds = ["m-replay"];
    }
    const { sessionId, cookie } = await joinAs(code);
    return { sessionId, cookie, missionId: "m-replay" };
  }

  it("serves blinded replay items, saves drafts, submits once, revises explicitly", async () => {
    const { sessionId, cookie, missionId } = await setupReplay();
    const runRes = await runPost(post(`/api/eval/session/${sessionId}/run`, { missionId }, cookie), params(sessionId));
    const run = (await runRes.json()) as {
      ok: boolean;
      runId: string;
      mode: string;
      items: Array<{ listingId: string; title: string }>;
    };
    expect(run.ok).toBe(true);
    expect(run.mode).toBe("replay");
    expect(run.items.map((i) => i.listingId)).toEqual(["l1", "l2"]);
    const leaked = FORBIDDEN_TESTER_KEYS.filter((k) => JSON.stringify(run).includes(`"${k}"`));
    expect(leaked).toEqual([]);

    const draft = await submitPost(
      post(`/api/eval/session/${sessionId}/submit`, { missionId, runId: run.runId, items: [{ listingId: "l1", grade: 3 }], draft: true }, cookie),
      params(sessionId)
    );
    expect(((await draft.json()) as { status: string }).status).toBe("draft");

    const badGrade = await submitPost(
      post(`/api/eval/session/${sessionId}/submit`, { missionId, runId: run.runId, items: [{ listingId: "l1", grade: 9 }] }, cookie),
      params(sessionId)
    );
    expect(badGrade.status).toBe(400);
    const unknownListing = await submitPost(
      post(`/api/eval/session/${sessionId}/submit`, { missionId, runId: run.runId, items: [{ listingId: "zzz", grade: 3 }] }, cookie),
      params(sessionId)
    );
    expect(unknownListing.status).toBe(400);

    const first = (await (
      await submitPost(
        post(
          `/api/eval/session/${sessionId}/submit`,
          { missionId, runId: run.runId, items: [{ listingId: "l1", grade: 3, reason: "خوب" }], outcome: { foundWhatWasAsked: "yes" } },
          cookie
        ),
        params(sessionId)
      )
    ).json()) as { ok: boolean; revisions?: number };
    expect(first.ok).toBe(true);
    expect(first.revisions).toBe(0);
    const second = (await (
      await submitPost(
        post(
          `/api/eval/session/${sessionId}/submit`,
          { missionId, runId: run.runId, items: [{ listingId: "l1", grade: 2 }] },
          cookie
        ),
        params(sessionId)
      )
    ).json()) as { revisions?: number };
    expect(second.revisions).toBe(1);

    // Resume shows the submitted state.
    const sess = (await (
      await sessionGet(get(`/api/eval/session/${sessionId}`, { cookie }), params(sessionId))
    ).json()) as { missions: Array<{ id: string; response: string | null }> };
    expect(sess.missions.find((m) => m.id === missionId)?.response).toBe("submitted");
  });

  it("rejects runs for unassigned missions", async () => {
    const { sessionId, cookie } = await setupReplay();
    const res = await runPost(post(`/api/eval/session/${sessionId}/run`, { missionId: "m-fridge" }, cookie), params(sessionId));
    expect(res.status).toBe(403);
  });
});

describe("resultset upload gate", () => {
  it("stores clean snapshots and refuses PII content", async () => {
    const admin = { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" };
    const good = await resultsetsPost(
      new NextRequest("http://test/api/eval/admin/resultsets", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          query: "یخچال",
          records: [{ listingId: "l1", title: "یخچال", description: "سالم", price: null, city: "", district: "" }],
        }),
      })
    );
    expect(((await good.json()) as { ok: boolean }).ok).toBe(true);
    const bad = await resultsetsPost(
      new NextRequest("http://test/api/eval/admin/resultsets", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          query: "یخچال",
          records: [{ listingId: "l1", title: "یخچال", description: "تماس 09123456789", price: null, city: "", district: "" }],
        }),
      })
    );
    expect(bad.status).toBe(400);
    const inv = await resultsetsGet(
      new NextRequest("http://test/api/eval/admin/resultsets", { headers: { authorization: `Bearer ${ADMIN}` } })
    );
    expect(((await inv.json()) as { resultSets: unknown[] }).resultSets).toHaveLength(1);
  });
});

describe("live gate and mocked live run", () => {
  it("refuses live execution unless explicitly allowed", async () => {
    const store = getStore();
    store.upsertMission({
      id: "m-live",
      version: 1,
      enabled: true,
      query: "یخچال",
      taskFa: "t",
      maxItems: 5,
      resultSetId: null,
      liveAllowed: true,
    });
    const inv = store.listInvitations().at(-1);
    const code = await adminMint("t-live");
    const target = store.listInvitations().at(-1);
    if (target) target.missionIds = ["m-live"];
    void inv;
    const { sessionId, cookie } = await joinAs(code);
    const res = await runPost(post(`/api/eval/session/${sessionId}/run`, { missionId: "m-live" }, cookie), params(sessionId));
    expect(res.status).toBe(503);
  });

  it("runs the real pipeline path with a mocked provider when allowed", async () => {
    vi.stubEnv("EVAL_ALLOW_LIVE", "1");
    const mocked = vi.mocked(divarProvider.searchLists);
    const mockedDetail = vi.mocked(divarProvider.getDetail);
    mocked.mockResolvedValueOnce({
      listings: [{ sourceAdId: "live1", title: "یخچال سالم", price: null, city: "تهران" }],
      hasMore: false,
    });
    mockedDetail.mockResolvedValueOnce({
      sourceAdId: "live1",
      title: "یخچال سالم",
      price: null,
      city: "تهران",
      description: "تمیز و سالم",
      images: [],
      categorySlug: "",
    });
    const store = getStore();
    store.upsertMission({
      id: "m-live2",
      version: 1,
      enabled: true,
      query: "یخچال",
      taskFa: "t",
      maxItems: 5,
      resultSetId: null,
      liveAllowed: true,
    });
    const code = await adminMint("t-live2");
    const target = store.listInvitations().at(-1);
    if (target) target.missionIds = ["m-live2"];
    const { sessionId, cookie } = await joinAs(code);
    const res = await runPost(post(`/api/eval/session/${sessionId}/run`, { missionId: "m-live2" }, cookie), params(sessionId));
    const body = (await res.json()) as { ok: boolean; mode?: string; items?: Array<{ listingId: string }> };
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("live");
    expect(body.items?.map((i) => i.listingId)).toEqual(["live1"]);
    const leaked = FORBIDDEN_TESTER_KEYS.filter((k) => JSON.stringify(body).includes(`"${k}"`));
    expect(leaked).toEqual([]);
  });
});

describe("export and stats", () => {
  it("exports submitted responses as JSON and CSV with grade separation", async () => {
    const store = getStore();
    store.putResultSet({
      id: "rs1",
      version: 1,
      createdAt: new Date().toISOString(),
      query: "یخچال",
      records: [{ listingId: "l1", title: "یخچال", description: "سالم", price: null, city: "", district: "" }],
    });
    store.upsertMission({
      id: "m-exp",
      version: 1,
      enabled: true,
      query: "یخچال",
      taskFa: "t",
      maxItems: 5,
      resultSetId: "rs1",
      liveAllowed: false,
    });
    const code = await adminMint("t-exp");
    const target = store.listInvitations().at(-1);
    if (target) target.missionIds = ["m-exp"];
    const { sessionId, cookie } = await joinAs(code);
    const run = (await (
      await runPost(post(`/api/eval/session/${sessionId}/run`, { missionId: "m-exp" }, cookie), params(sessionId))
    ).json()) as { runId: string };
    await submitPost(
      post(
        `/api/eval/session/${sessionId}/submit`,
        { missionId: "m-exp", runId: run.runId, items: [{ listingId: "l1", grade: "insufficient", ambiguous: true }] },
        cookie
      ),
      params(sessionId)
    );
    const json = (await (
      await exportGet(new NextRequest("http://test/api/eval/admin/export?format=json", { headers: { authorization: `Bearer ${ADMIN}` } }))
    ).json()) as { count: number; responses: Array<{ items: Array<{ grade: unknown }> }> };
    expect(json.count).toBe(1);
    expect(json.responses[0].items[0].grade).toBe("insufficient");
    const csv = await (
      await exportGet(new NextRequest("http://test/api/eval/admin/export?format=csv", { headers: { authorization: `Bearer ${ADMIN}` } }))
    ).text();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("grade");
    expect(lines[1]).toContain("insufficient");
    const stats = (await (
      await statsGet(new NextRequest("http://test/api/eval/admin/stats", { headers: { authorization: `Bearer ${ADMIN}` } }))
    ).json()) as { responsesSubmitted: number; grades: Record<string, number>; participants: number };
    expect(stats.responsesSubmitted).toBe(1);
    expect(stats.grades["insufficient"]).toBe(1);
    expect(stats.participants).toBe(1);
  });
});
