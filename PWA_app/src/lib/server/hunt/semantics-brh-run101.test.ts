import { describe, expect, it } from "vitest";
import { assessListingRole, assessRepairPolarity } from "./semantics";

describe("BRH Run 101 — human-grade boundary regressions", () => {
  it("does not infer repair-free history from 'like new / clean / low use' wording", () => {
    const result = assessRepairPolarity(
      "درحد نو و بسیار تمیز و کم کارکرد به همراه چند عدد کتاب"
    );

    // No repair-history claim is present. Absence of evidence must stay unknown.
    expect(result.polarity).toBe("unknown");
  });

  it("treats explicit negated repair history as condition evidence, not a service offer", () => {
    const text = "پیانو تعمیر یا تعویض نشده است";
    expect(assessRepairPolarity(text).polarity).toBe("absent");
    expect(assessListingRole(text).role).not.toBe("service");
  });

  it("classifies a pure piano-repair service as service intent", () => {
    expect(assessListingRole("تعمیر پیانو دیجیتال").role).toBe("service");
  });

  it("explicit first-person instrument buying overrides service-like words", () => {
    expect(
      assessListingRole("ارگ و پیانو خریداریم؛ خرید در محل شما")
    ).toMatchObject({ role: "buyer-seeking" });
  });

  it("recognizes a direct seller cue as product intent", () => {
    expect(assessListingRole("فروش پیانو دیجیتال سالم").role).toBe("product");
  });

  it("keeps explicit exchange intent distinct from a direct sale", () => {
    expect(
      assessListingRole("تریلی معاوضه با کفی سه محور").role
    ).toBe("exchange");
  });

  it("does not promote missing role evidence into a seller role", () => {
    expect(
      assessListingRole("پیانو C1 AIR KORG ژاپن اصلی")
    ).toMatchObject({ role: "unknown" });
  });
});
