import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { copyIsTesterSafe, GRADE_OPTIONS } from "@/lib/eval-copy";
import { seedMissions, validateMissionDefinition } from "@/lib/server/eval/missions";
import { createStore } from "@/lib/server/eval/store";
import { validateResultSet } from "@/lib/server/eval/snapshots";
import {
  hashInvitationCode,
  mintInvitationCode,
  verifyInvitationCode,
} from "@/lib/server/eval/tokens";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invitation tokens", () => {
  it("mints opaque codes verified only by hash", () => {
    const code = mintInvitationCode();
    expect(code.startsWith("ev_")).toBe(true);
    const hash = hashInvitationCode(code);
    expect(hash).not.toContain(code.slice(3, 12));
    expect(verifyInvitationCode(code, hash)).toBe(true);
    expect(verifyInvitationCode(code + "x", hash)).toBe(false);
    expect(verifyInvitationCode(code, "00".repeat(32))).toBe(false);
  });
});

describe("mission seeds and validation", () => {
  it("seeds the six-mission challenge suite without labels", () => {
    const missions = seedMissions();
    expect(missions.map((m) => m.id)).toEqual([
      "m-iphone13pro",
      "m-iphone13",
      "m-iphone13-norepair",
      "m-fridge-repair",
      "m-fridge-buyer",
      "m-fridge",
    ]);
    const blob = JSON.stringify(missions);
    for (const leak of ["expectedGrade", "verdict", "score", "matchKind"]) {
      expect(blob).not.toContain(leak);
    }
  });

  it("rejects malformed mission definitions", () => {
    expect(validateMissionDefinition(null)).toBeNull();
    expect(validateMissionDefinition({ id: "BAD ID!", query: "x" })).toBeNull();
    expect(validateMissionDefinition({ id: "m-x", query: "" })).toBeNull();
    const ok = validateMissionDefinition({ id: "m-x", query: "یخچال" });
    expect(ok?.maxItems).toBe(12);
    expect(validateMissionDefinition({ id: "m-x", query: "یخچال", maxItems: 99 })?.maxItems).toBe(12);
  });
});

describe("snapshot validation", () => {
  const good = {
    query: "یخچال",
    records: [{ listingId: "a1", title: "یخچال سالم", description: "تمیز", price: 100, city: "تهران", district: "" }],
  };

  it("accepts a clean redacted snapshot", () => {
    const r = validateResultSet(good);
    expect(r.ok).toBe(true);
  });

  it("refuses phone-like content instead of scrubbing it", () => {
    const bad = {
      query: "یخچال",
      records: [{ listingId: "a1", title: "یخچال", description: "تماس 09123456789", price: null, city: "", district: "" }],
    };
    const r = validateResultSet(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].reason).toContain("pii-suspect");
  });

  it("refuses duplicates, oversize payloads, and bad prices", () => {
    const dup = {
      query: "یخچال",
      records: [
        { listingId: "a1", title: "x", description: "y", price: null, city: "", district: "" },
        { listingId: "a1", title: "x", description: "y", price: null, city: "", district: "" },
      ],
    };
    expect(validateResultSet(dup).ok).toBe(false);
    expect(
      validateResultSet({ query: "یخچال", records: [] }).ok
    ).toBe(false);
    expect(
      validateResultSet({
        query: "یخچال",
        records: [{ listingId: "a1", title: "x", description: "y", price: -5, city: "", district: "" }],
      }).ok
    ).toBe(false);
  });
});

describe("file store durability", () => {
  function freshDir(): string {
    return mkdtempSync(join(tmpdir(), "eval-store-test-"));
  }

  it("persists across restarts (re-instantiation reads the same files)", () => {
    const dir = freshDir();
    const s1 = createStore(dir);
    expect(s1.listMissions()).toHaveLength(6);
    const inv = s1.createInvitation({
      id: "h",
      cohort: "c",
      missionIds: ["m-fridge"],
      missionSetVersion: 1,
      maxUses: 1,
      uses: 0,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      revoked: false,
      createdAt: new Date().toISOString(),
    });
    expect(inv.uses).toBe(0);
    const s2 = createStore(dir);
    expect(s2.listMissions()).toHaveLength(6);
    expect(s2.getInvitation("h")?.cohort).toBe("c");
    expect(s2.consumeInvitation("h")?.uses).toBe(1);
    expect(createStore(dir).consumeInvitation("h")).toBeNull();
  });

  it("submit is idempotent and resubmits append revisions", () => {
    const s = createStore(freshDir());
    const base = {
      id: "r",
      sessionId: "sess",
      missionId: "m-fridge",
      missionSetVersion: 1,
      runId: "run",
      items: [],
      outcome: {},
      status: "draft" as const,
      submittedAt: null as string | null,
      revisions: [] as Array<{ at: string; note?: string }>,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const first = s.submitResponse({ ...base });
    expect(first.status).toBe("submitted");
    expect(first.revisions).toHaveLength(0);
    const second = s.submitResponse({ ...base }, "correction");
    expect(second.revisions).toHaveLength(1);
    expect(s.getResponse("sess", "m-fridge")?.revisions).toHaveLength(1);
  });
});

describe("tester copy contract", () => {
  it("covers all five grades with non-technical Persian labels", () => {
    expect(GRADE_OPTIONS.map((g) => g.value)).toEqual([3, 2, 1, 0, "insufficient"]);
    for (const g of GRADE_OPTIONS) {
      expect(copyIsTesterSafe(g.fa)).toBe(true);
    }
  });

  it("rejects engine-internal terminology", () => {
    expect(copyIsTesterSafe("semantic cap verdict")).toBe(false);
    expect(copyIsTesterSafe("MUST-missing titleStrength")).toBe(false);
  });
});

describe("rtl contract (structural regression guard)", () => {
  // Full visual/responsive QA at 480x840 and desktop viewports requires a
  // running dev server plus manual pass (documented as remaining). These
  // tests lock the structural contract the UI relies on: Persian RTL root
  // and no LTR override or engine jargon inside eval pages.
  const HERE = dirname(fileURLToPath(import.meta.url));
  const root = (...parts: string[]) =>
    readFileSync(resolve(HERE, "..", "..", "..", ...parts), "utf-8");

  it("root layout stays Persian RTL", () => {
    const layout = root("app", "layout.tsx");
    expect(layout).toMatch(/lang="fa"/);
    expect(layout).toMatch(/dir="rtl"/);
  });

  it("eval pages keep RTL, mobile-first shells, and clean copy", () => {
    for (const page of [
      ["app", "eval", "page.tsx"],
      ["app", "eval", "s", "[id]", "page.tsx"],
      ["app", "eval", "admin", "page.tsx"],
    ]) {
      const src = root(...page);
      // Latin code/token inputs may stay LTR; structural shells must not.
      expect(src).not.toMatch(/<(main|div|section)[^>]*dir="ltr"/);
      expect(src).toMatch(/max-w-(md|2xl)/);
      for (const line of src.split("\n")) {
        if (line.includes("fa:") || /[\u0600-\u06FF]/.test(line)) {
          expect(copyIsTesterSafe(line)).toBe(true);
        }
      }
    }
  });
});
