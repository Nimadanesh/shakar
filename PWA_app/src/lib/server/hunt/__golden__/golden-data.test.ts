import { describe, expect, it } from "vitest";

import titles from "./golden-titles.json";
import labels from "./golden-labels.json";

// HANDOFF-G — the ONLY test for the golden set: data sanity, never
// measurement numbers. No assertion here depends on an engine tier,
// a leak count, or an agreement percentage.
describe("HANDOFF-G — golden data sanity", () => {
  it("has 200 rows, 10 hunts of 20 ads, grades 1-4, and an answer per hunt", () => {
    expect(titles.length).toBe(200);
    const hunts = new Map<number, typeof titles>();
    for (const t of titles) {
      const list = hunts.get(t.hunt) ?? [];
      list.push(t);
      hunts.set(t.hunt, list);
    }
    expect([...hunts.keys()].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    for (const [hunt, rows] of hunts) {
      expect(rows.length).toBe(20);
      expect(rows.map((r) => r.row).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1)
      );
      expect(new Set(rows.map((r) => r.id)).size).toBe(20);
      void hunt;
    }
    expect(labels.hunts.length).toBe(10);
    for (const h of labels.hunts) {
      expect(Object.keys(h.grades).length).toBe(20);
      for (const g of Object.values(h.grades)) {
        expect(g).toBeGreaterThanOrEqual(1);
        expect(g).toBeLessThanOrEqual(4);
      }
      // Every hunt carries exactly one disambiguation answer.
      const answerKeys = Object.keys(h.answer);
      expect(answerKeys.length).toBe(1);
      expect(["transaction", "condition"]).toContain(answerKeys[0]);
      // Every title row has a grade, and every grade has a title row.
      const rows = hunts.get(h.hunt) as typeof titles;
      for (const r of rows) {
        expect(Object.keys(h.grades)).toContain(String(r.row));
      }
    }
  });
});
