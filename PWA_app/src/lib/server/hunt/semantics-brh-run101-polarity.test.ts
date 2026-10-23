import { describe, expect, it } from "vitest";
import { assessAbsencePolarity, assessRepairPolarity } from "./semantics";

describe("BRH Run 101 — repair and replacement history boundaries", () => {
  it("keeps low-use and clean wording unknown for replacement history", () => {
    expect(
      assessAbsencePolarity("درحد نو، بسیار تمیز و کم کارکرد", "تعویض").polarity
    ).toBe("unknown");
  });

  it("recognizes explicit negated replacement history as absent", () => {
    expect(
      assessAbsencePolarity("پیانو تعویض نشده است", "تعویض").polarity
    ).toBe("absent");
  });

  it("recognizes explicit positive replacement history as present", () => {
    expect(
      assessAbsencePolarity("قطعه تعویض شده است", "تعویض").polarity
    ).toBe("present");
  });

  it("does not infer replacement history from technician inspection alone", () => {
    expect(
      assessAbsencePolarity("کارشناس فنی دستگاه را بررسی و بازدید می‌کند", "تعویض")
        .polarity
    ).toBe("unknown");
  });

  it("does not infer repair history from service or inspection alone", () => {
    expect(
      assessRepairPolarity("سرویس و بازدید توسط تعمیرکار متخصص").polarity
    ).toBe("unknown");
  });
});
