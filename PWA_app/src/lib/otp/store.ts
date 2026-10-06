/**
 * OTP verification state. Codes are stored HASHED (SHA-256) — never
 * plaintext. Two implementations behind one interface:
 * - SupabaseOtpStore: production (PostgREST, service_role).
 * - MemoryOtpStore: development fallback when Supabase env is absent.
 */

export interface OtpRecord {
  id: string;
  mobile: string;
  codeHash: string;
  expiresAt: number; // epoch ms
  attempts: number;
  maxAttempts: number;
  consumedAt: number | null;
  createdAt: number;
}

/**
 * Post-increment attempt count. The increment itself is the atomic
 * operation (single UPDATE via the increment_otp_attempts RPC); the
 * returned count is authoritative — never re-read-then-decide.
 */
export interface AttemptCount {
  attempts: number;
  maxAttempts: number;
}

export interface ClaimSendInput {
  mobile: string;
  codeHash: string;
  expiresAt: number;
  maxAttempts: number;
  /** Max sends allowed inside the window (product constant). */
  limit: number;
  /** Window length in seconds. */
  windowSecs: number;
}

export interface OtpStore {
  create(input: {
    mobile: string;
    codeHash: string;
    expiresAt: number;
    maxAttempts: number;
  }): Promise<OtpRecord>;
  latestActive(mobile: string, now: number): Promise<OtpRecord | null>;
  incrementAttempts(id: string): Promise<AttemptCount | null>;
  consume(id: string, now: number): Promise<void>;
  /** Removes a record entirely (used when the SMS send itself failed). */
  remove(id: string): Promise<void>;
  sentSince(mobile: string, since: number): Promise<number>;
  /**
   * Atomically claims one send slot for the mobile: counts recent sends
   * and inserts the new verification row ONLY when under the limit.
   * Returns the new row id, or null when the mobile is over its limit.
   * (Finding #10: replaces the racy sentSince()+create() pair.)
   */
  claimSend(input: ClaimSendInput): Promise<{ id: string } | null>;
}

export async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`shakar-otp:${code}`)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison for fixed-length hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function makeId(): string {
  return crypto.randomUUID();
}

/* ---------------- in-memory (dev) ---------------- */

export class MemoryOtpStore implements OtpStore {
  private rows = new Map<string, OtpRecord>();

  async create(input: {
    mobile: string;
    codeHash: string;
    expiresAt: number;
    maxAttempts: number;
  }): Promise<OtpRecord> {
    const now = Date.now();
    const rec: OtpRecord = {
      id: makeId(),
      mobile: input.mobile,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      consumedAt: null,
      createdAt: now,
    };
    this.rows.set(rec.id, rec);
    return rec;
  }

  async latestActive(mobile: string, now: number): Promise<OtpRecord | null> {
    let best: OtpRecord | null = null;
    for (const r of this.rows.values()) {
      if (r.mobile !== mobile || r.consumedAt !== null || r.expiresAt <= now) continue;
      if (!best || r.createdAt > best.createdAt) best = r;
    }
    return best;
  }

  async incrementAttempts(id: string): Promise<AttemptCount | null> {
    const r = this.rows.get(id);
    if (!r) return null;
    r.attempts += 1;
    return { attempts: r.attempts, maxAttempts: r.maxAttempts };
  }

  async consume(id: string, now: number): Promise<void> {
    const r = this.rows.get(id);
    if (r) r.consumedAt = now;
  }

  async remove(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async sentSince(mobile: string, since: number): Promise<number> {
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.mobile === mobile && r.createdAt >= since) n++;
    }
    return n;
  }

  async claimSend(input: ClaimSendInput): Promise<{ id: string } | null> {
    // Single-threaded dev store: count-then-insert cannot interleave.
    const now = Date.now();
    const since = now - input.windowSecs * 1000;
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.mobile === input.mobile && r.createdAt >= since) n++;
    }
    if (n >= input.limit) return null;
    const rec = await this.create(input);
    return { id: rec.id };
  }
}

/* ---------------- Supabase (production) ---------------- */

interface SbRow {
  id: string;
  mobile: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
  created_at: string;
}

function toRecord(row: SbRow): OtpRecord {
  return {
    id: row.id,
    mobile: row.mobile,
    codeHash: row.code_hash,
    expiresAt: Date.parse(row.expires_at),
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    consumedAt: row.consumed_at ? Date.parse(row.consumed_at) : null,
    createdAt: Date.parse(row.created_at),
  };
}

/**
 * The RPC functions may not be installed yet (navid runs the migration
 * manually). A 404 from PostgREST means "function missing" → fall back.
 * Same duck-typing as quota.ts.
 */
function isMissingRpc(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 404
  );
}

export class SupabaseOtpStore implements OtpStore {
  constructor(
    private readonly rest: <T>(
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      body?: unknown
    ) => Promise<T>
  ) {}

  async create(input: {
    mobile: string;
    codeHash: string;
    expiresAt: number;
    maxAttempts: number;
  }): Promise<OtpRecord> {
    const rows = await this.rest<SbRow[]>("POST", "/otp_verifications", {
      mobile: input.mobile,
      code_hash: input.codeHash,
      expires_at: new Date(input.expiresAt).toISOString(),
      max_attempts: input.maxAttempts,
    });
    return toRecord(rows[0]);
  }

  async latestActive(mobile: string, now: number): Promise<OtpRecord | null> {
    const q =
      `/otp_verifications?mobile=eq.${encodeURIComponent(mobile)}` +
      `&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}` +
      `&order=created_at.desc&limit=1`;
    const rows = await this.rest<SbRow[]>("GET", q);
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  /**
   * Finding #6: the increment is ONE UPDATE statement
   * (increment_otp_attempts RPC) — the linearization point. Two racing
   * verifies can no longer read the same count and both write count+1.
   * Falls back to the legacy racy GET+PATCH with a loud warning when the
   * m8 migration hasn't been run yet.
   */
  async incrementAttempts(id: string): Promise<AttemptCount | null> {
    try {
      const rows = await this.rest<Array<{ attempts: number; max_attempts: number }>>(
        "POST",
        "/rpc/increment_otp_attempts",
        { p_id: id }
      );
      if (rows.length === 0) return null;
      return { attempts: rows[0].attempts, maxAttempts: rows[0].max_attempts };
    } catch (e) {
      if (!isMissingRpc(e)) throw e;
      console.warn(
        "[otp] increment_otp_attempts RPC missing — legacy racy GET+PATCH. " +
          "Run supabase/m8-otp-atomic.sql."
      );
      const current = await this.rest<SbRow[]>(
        "GET",
        `/otp_verifications?id=eq.${encodeURIComponent(id)}&select=id,attempts,max_attempts&limit=1`
      );
      if (current.length === 0) return null;
      const rows = await this.rest<SbRow[]>(
        "PATCH",
        `/otp_verifications?id=eq.${encodeURIComponent(id)}`,
        { attempts: current[0].attempts + 1 }
      );
      if (rows.length === 0) return null;
      return { attempts: rows[0].attempts, maxAttempts: rows[0].max_attempts };
    }
  }

  async consume(id: string, now: number): Promise<void> {
    await this.rest("PATCH", `/otp_verifications?id=eq.${encodeURIComponent(id)}`, {
      consumed_at: new Date(now).toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    await this.rest("DELETE", `/otp_verifications?id=eq.${encodeURIComponent(id)}`);
  }

  async sentSince(mobile: string, since: number): Promise<number> {
    const rows = await this.rest<Array<{ id: string }>>(
      "GET",
      `/otp_verifications?mobile=eq.${encodeURIComponent(mobile)}` +
        `&created_at=gte.${encodeURIComponent(new Date(since).toISOString())}&select=id`
    );
    return rows.length;
  }

  /**
   * Finding #10b: count-and-insert in ONE statement (claim_otp_send RPC).
   * Two racing sends cannot both see "4 < 5" and both insert. Returns the
   * new row id, or null when the mobile is over its limit. Falls back to
   * the legacy racy pair with a loud warning when m8 isn't installed yet.
   */
  async claimSend(input: ClaimSendInput): Promise<{ id: string } | null> {
    try {
      const rows = await this.rest<Array<{ id: string }>>(
        "POST",
        "/rpc/claim_otp_send",
        {
          p_mobile: input.mobile,
          p_code_hash: input.codeHash,
          p_expires_at: new Date(input.expiresAt).toISOString(),
          p_max_attempts: input.maxAttempts,
          p_limit: input.limit,
          p_window_secs: input.windowSecs,
        }
      );
      return rows.length > 0 ? { id: rows[0].id } : null;
    } catch (e) {
      if (!isMissingRpc(e)) throw e;
      console.warn(
        "[otp] claim_otp_send RPC missing — legacy racy sentSince+create. " +
          "Run supabase/m8-otp-atomic.sql."
      );
      if ((await this.sentSince(input.mobile, Date.now() - input.windowSecs * 1000)) >= input.limit) {
        return null;
      }
      const rec = await this.create(input);
      return { id: rec.id };
    }
  }
}
