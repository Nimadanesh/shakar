import "server-only";

import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { seedMissions } from "./missions";
import type {
  EvalSession,
  Invitation,
  MissionDefinition,
  MissionResponse,
  MissionRun,
  ResultSet,
} from "./types";

/**
 * Durable file-backed evaluation store (private MVP).
 *
 * - One JSON document per entity collection, written atomically
 *   (temp file + rename) so restarts never observe torn writes.
 * - Directory: EVAL_DATA_DIR, else os.tmpdir()/shakar-eval-data (local MVP).
 *   Production path (Supabase) is declared in supabase/m26-eval.sql; this
 *   module is the seam where a db backend would attach (same method set).
 * - No personal data is collected or stored by design (see types.ts).
 * - createStore(dir) is used by tests for isolation; getStore() is the
 *   process singleton used by routes.
 */

interface Tables {
  missions: Record<string, MissionDefinition>;
  invitations: Record<string, Invitation>;
  sessions: Record<string, EvalSession>;
  runs: Record<string, MissionRun>;
  responses: Record<string, MissionResponse>;
  resultSets: Record<string, ResultSet>;
}

const EMPTY: Tables = {
  missions: {},
  invitations: {},
  sessions: {},
  runs: {},
  responses: {},
  resultSets: {},
};

export function resolveDataDir(): string {
  const override = process.env.EVAL_DATA_DIR?.trim();
  if (override) return override;
  return join(tmpdir(), "shakar-eval-data");
}

export class EvalStore {
  private readonly dir: string;
  private tables: Tables;

  constructor(dir?: string) {
    this.dir = dir ?? resolveDataDir();
    mkdirSync(this.dir, { recursive: true });
    this.tables = this.load();
    if (Object.keys(this.tables.missions).length === 0) {
      for (const m of seedMissions()) this.tables.missions[m.id] = m;
      this.save();
    }
  }

  get directory(): string {
    return this.dir;
  }

  private path(name: keyof Tables): string {
    return join(this.dir, `${name}.json`);
  }

  private load(): Tables {
    const out: Tables = JSON.parse(JSON.stringify(EMPTY)) as Tables;
    for (const name of Object.keys(EMPTY) as Array<keyof Tables>) {
      try {
        const raw = readFileSync(this.path(name), "utf-8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") {
          (out[name] as Record<string, unknown>) = parsed;
        }
      } catch {
        /* missing or corrupt file starts empty (documented fallback) */
      }
    }
    return out;
  }

  private save(): void {
    for (const name of Object.keys(EMPTY) as Array<keyof Tables>) {
      const tmp = `${this.path(name)}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.tables[name], null, 2), "utf-8");
      renameSync(tmp, this.path(name));
    }
  }

  // Missions
  listMissions(): MissionDefinition[] {
    return Object.values(this.tables.missions).sort((a, b) =>
      a.id < b.id ? -1 : 1
    );
  }

  getMission(id: string): MissionDefinition | null {
    return this.tables.missions[id] ?? null;
  }

  upsertMission(m: MissionDefinition): MissionDefinition {
    this.tables.missions[m.id] = m;
    this.save();
    return m;
  }

  // Invitations
  createInvitation(inv: Invitation): Invitation {
    this.tables.invitations[inv.id] = inv;
    this.save();
    return inv;
  }

  getInvitation(id: string): Invitation | null {
    return this.tables.invitations[id] ?? null;
  }

  /** Atomically consume one use; returns null when unusable. */
  consumeInvitation(id: string): Invitation | null {
    const inv = this.tables.invitations[id];
    if (!inv || inv.revoked) return null;
    if (Date.now() > Date.parse(inv.expiresAt)) return null;
    if (inv.uses >= inv.maxUses) return null;
    inv.uses += 1;
    this.save();
    return inv;
  }

  revokeInvitation(id: string): boolean {
    const inv = this.tables.invitations[id];
    if (!inv) return false;
    inv.revoked = true;
    this.save();
    return true;
  }

  listInvitations(): Invitation[] {
    return Object.values(this.tables.invitations);
  }

  // Sessions
  createSession(s: EvalSession): EvalSession {
    this.tables.sessions[s.id] = s;
    this.save();
    return s;
  }

  getSession(id: string): EvalSession | null {
    return this.tables.sessions[id] ?? null;
  }

  touchSession(id: string, status?: EvalSession["status"]): EvalSession | null {
    const s = this.tables.sessions[id];
    if (!s) return null;
    s.updatedAt = new Date().toISOString();
    if (status) s.status = status;
    this.save();
    return s;
  }

  listSessions(): EvalSession[] {
    return Object.values(this.tables.sessions);
  }

  // Runs
  createRun(r: MissionRun): MissionRun {
    this.tables.runs[r.id] = r;
    this.save();
    return r;
  }

  runsBySession(sessionId: string): MissionRun[] {
    return Object.values(this.tables.runs)
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  }

  // Responses (one doc per session+mission; resubmit appends a revision)
  responseKey(sessionId: string, missionId: string): string {
    return `${sessionId}:${missionId}`;
  }

  getResponse(sessionId: string, missionId: string): MissionResponse | null {
    return this.tables.responses[this.responseKey(sessionId, missionId)] ?? null;
  }

  saveDraft(r: MissionResponse): MissionResponse {
    r.status = "draft";
    r.updatedAt = new Date().toISOString();
    this.tables.responses[this.responseKey(r.sessionId, r.missionId)] = r;
    this.save();
    return r;
  }

  submitResponse(r: MissionResponse, note?: string): MissionResponse {
    const key = this.responseKey(r.sessionId, r.missionId);
    const prev = this.tables.responses[key];
    const now = new Date().toISOString();
    if (prev && prev.status === "submitted") {
      prev.revisions.push({ at: now, note });
      prev.items = r.items;
      prev.outcome = r.outcome;
      prev.runId = r.runId;
      prev.missionSetVersion = r.missionSetVersion;
      prev.updatedAt = now;
      this.save();
      return prev;
    }
    r.status = "submitted";
    r.submittedAt = now;
    r.updatedAt = now;
    if (!Array.isArray(r.revisions)) r.revisions = [];
    this.tables.responses[key] = r;
    this.save();
    return r;
  }

  queryResponses(filter?: {
    missionId?: string;
    cohort?: string;
    status?: MissionResponse["status"];
  }): MissionResponse[] {
    return Object.values(this.tables.responses).filter(
      (r) =>
        (!filter?.missionId || r.missionId === filter.missionId) &&
        (!filter?.status || r.status === filter.status) &&
        (!filter?.cohort || this.tables.sessions[r.sessionId]?.cohort === filter.cohort)
    );
  }

  // Result sets (replay snapshots uploaded by admin, validated first)
  putResultSet(rs: ResultSet): ResultSet {
    this.tables.resultSets[rs.id] = rs;
    this.save();
    return rs;
  }

  getResultSet(id: string): ResultSet | null {
    return this.tables.resultSets[id] ?? null;
  }

  listResultSets(): Array<Pick<ResultSet, "id" | "version" | "createdAt" | "query"> & { records: number }> {
    return Object.values(this.tables.resultSets).map((rs) => ({
      id: rs.id,
      version: rs.version,
      createdAt: rs.createdAt,
      query: rs.query,
      records: rs.records.length,
    }));
  }

  newId(prefix: string): string {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
}

let singleton: EvalStore | null = null;

/** Process singleton used by API routes. */
export function getStore(): EvalStore {
  if (!singleton) singleton = new EvalStore();
  return singleton;
}

/** Test hook: reset the process singleton (tests use createStore instead). */
export function resetStoreForTests(): void {
  singleton = null;
}

export function createStore(dir: string): EvalStore {
  return new EvalStore(dir);
}
