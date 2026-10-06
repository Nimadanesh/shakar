import { describe, expect, it } from "vitest";
import { faDigits, kaminPushBody, kaminPushTitle } from "./copy";

describe("M5 push copy (locked)", () => {
  it("title carries the real count in Persian digits", () => {
    expect(kaminPushTitle(3)).toBe("۳ آگهی تازه");
    expect(kaminPushTitle(12)).toBe("۱۲ آگهی تازه");
    expect(kaminPushTitle(1)).toBe("۱ آگهی تازه");
  });

  it("body names the kamin, no bragging", () => {
    expect(kaminPushBody("پیانو یاماها")).toBe("کمین «پیانو یاماها» — بزن ببین.");
  });

  it("faDigits converts all digits", () => {
    expect(faDigits(2026)).toBe("۲۰۲۶");
    expect(faDigits(0)).toBe("۰");
  });
});
