import "server-only";

import type { ResultSet, ResultSetRecord } from "./types";

/**
 * Snapshot (replay result-set) validation for admin uploads.
 *
 * Snapshots carry listing CONTENT shown to testers, so they are screened
 * before storage: strict shape limits plus a PII sweep (phone-like digit
 * runs, @-handles, URLs, messenger names). Anything suspicious is
 * rejected with a field-level reason — never silently scrubbed, so the
 * admin sees exactly what was refused.
 */

const MAX_RECORDS = 200;
const MAX_TEXT = 4000;

const PII_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "long-digit-run", re: /[0-9۰-۹٠-٩]{7,}/ },
  { name: "handle-or-url", re: /@|https?:\/\/|www\./i },
  {
    name: "messenger",
    re: /تلگرام|تلگرم|واتس|ایتا|روبیکا|بله/i,
  },
];

export interface SnapshotIssue {
  index: number;
  field: string;
  reason: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function validateResultSet(body: unknown): {
  ok: true;
  value: Omit<ResultSet, "id" | "version" | "createdAt">;
} | {
  ok: false;
  issues: SnapshotIssue[];
} {
  const issues: SnapshotIssue[] = [];
  if (!isRecord(body)) return { ok: false, issues: [{ index: -1, field: "body", reason: "not-an-object" }] };
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query === "" || query.length > 200) {
    return { ok: false, issues: [{ index: -1, field: "query", reason: "missing-or-too-long" }] };
  }
  if (!Array.isArray(body.records)) {
    return { ok: false, issues: [{ index: -1, field: "records", reason: "not-an-array" }] };
  }
  if (body.records.length === 0 || body.records.length > MAX_RECORDS) {
    return {
      ok: false,
      issues: [{ index: -1, field: "records", reason: "empty-or-over-limit" }],
    };
  }
  const ids = new Set<string>();
  const records: ResultSetRecord[] = [];
  body.records.forEach((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      issues.push({ index, field: "record", reason: "not-an-object" });
      return;
    }
    const str = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      if (v.length > max) return null;
      return v;
    };
    const listingId = typeof raw.listingId === "string" ? raw.listingId.trim() : "";
    const title = str(raw.title, MAX_TEXT);
    const description = str(raw.description, MAX_TEXT);
    if (listingId === "" || listingId.length > 120 || ids.has(listingId)) {
      issues.push({ index, field: "listingId", reason: "missing-duplicate-or-too-long" });
      return;
    }
    if (title === null || title.trim() === "") {
      issues.push({ index, field: "title", reason: "missing-or-too-long" });
      return;
    }
    if (description === null) {
      issues.push({ index, field: "description", reason: "missing-or-too-long" });
      return;
    }
    const price =
      raw.price === null || raw.price === undefined
        ? null
        : typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price >= 0
          ? raw.price
          : -1;
    if (price === -1) {
      issues.push({ index, field: "price", reason: "invalid" });
      return;
    }
    const city = typeof raw.city === "string" ? raw.city.slice(0, 80) : "";
    const district = typeof raw.district === "string" ? raw.district.slice(0, 80) : "";
    const haystack = `${title} ${description} ${city} ${district}`;
    for (const p of PII_PATTERNS) {
      if (p.re.test(haystack)) {
        issues.push({ index, field: "text", reason: `pii-suspect:${p.name}` });
        return;
      }
    }
    ids.add(listingId);
    records.push({ listingId, title, description, price, city, district });
  });
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { query, records } };
}
