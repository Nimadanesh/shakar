import { describe, expect, it } from "vitest";
import { assessExchangeTargetEvidence } from "./exchangeTargetEvidence";

describe("BRH Run 101 — isolated exchange target evidence", () => {
  it("supports the requested flatbed when its three-axle attribute is on that side", () => {
    expect(
      assessExchangeTargetEvidence(
        "تریلی معاوضه با کفی سه محور",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "supported",
      targetSide: "requested",
      itemEvidence: "کفی",
      attributeEvidence: "سه محور",
      reason: "item-and-attribute-on-same-side",
    });
  });

  it("supports a three-axle flatbed when it is the offered item", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفی سه محور معاوضه با تانکر تمیز",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "supported",
      targetSide: "offered",
      itemEvidence: "کفی",
      attributeEvidence: "سه محور",
    });
  });

  it("keeps the flatbed attribute unknown when only the requested tanker is three-axle", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفی معاوضه با تانکر سه محور",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "offered",
      itemEvidence: "کفی",
      attributeEvidence: null,
      reason: "attribute-only-on-opposite-side",
    });
  });

  it("supports a target item whose own side independently states the attribute", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفی سه محور معاوضه با تانکر سه محور",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "supported",
      targetSide: "offered",
      attributeEvidence: "سه محور",
    });
  });

  it("does not infer an axle attribute from a requested item alone", () => {
    expect(
      assessExchangeTargetEvidence("معاوضه با کفی", ["کفی"], ["سه محور"])
    ).toMatchObject({
      status: "unknown",
      targetSide: "requested",
      itemEvidence: "کفی",
      attributeEvidence: null,
      reason: "attribute-not-found-on-target-side",
    });
  });

  it("keeps target ownership unknown when the exchange boundary is absent", () => {
    expect(
      assessExchangeTargetEvidence("کفی سه محور تانکر تمیز", ["کفی"], ["سه محور"])
    ).toMatchObject({
      status: "unknown",
      targetSide: "unknown",
      reason: "unsegmented:no-explicit-exchange-boundary",
    });
  });

  it("does not guess when the target item appears on both sides", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفی سه محور معاوضه با کفی تمیز",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "unknown",
      reason: "target-item-on-both-sides",
    });
  });
  it("does not match a target item as a substring inside a longer word", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفیسازی سه محور معاوضه با تانکر تمیز",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "unknown",
      reason: "target-item-not-found",
    });
  });

  it("does not match an attribute as a substring inside a longer word", () => {
    expect(
      assessExchangeTargetEvidence(
        "کفی سه محوری معاوضه با تانکر تمیز",
        ["کفی"],
        ["سه محور"]
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "offered",
      itemEvidence: "کفی",
      attributeEvidence: null,
      reason: "attribute-not-found-on-target-side",
    });
  });

});


describe("Synthetic counterfactuals — exchange paint polarity (not live Divar evidence)", () => {
  const target = ["پژو ۲۰۶"];
  const wanted = ["بدون رنگ"];
  const contradiction = ["رنگ داره", "رنگ دارد", "گلگیر رنگ"];

  it("marks explicit target-side paint evidence as contradicted on the requested side", () => {
    expect(
      assessExchangeTargetEvidence(
        "موتور معاوضه با پژو ۲۰۶ گلگیر عقب رنگ داره",
        target,
        wanted,
        contradiction
      )
    ).toMatchObject({
      status: "contradicted",
      targetSide: "requested",
      itemEvidence: "پژو ۲۰۶",
      attributeEvidence: "رنگ داره",
      reason: "target-side-attribute-explicitly-contradicted",
    });
  });

  it("does not transfer explicit paint evidence from the opposite vehicle", () => {
    expect(
      assessExchangeTargetEvidence(
        "موتور رنگ داره معاوضه با پژو ۲۰۶",
        target,
        wanted,
        contradiction
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "requested",
      itemEvidence: "پژو ۲۰۶",
      attributeEvidence: null,
      reason: "attribute-only-on-opposite-side",
    });
  });

  it("keeps mixed positive and contradictory target-side phrases unknown", () => {
    expect(
      assessExchangeTargetEvidence(
        "موتور معاوضه با پژو ۲۰۶ بدون رنگ ولی یک گلگیر رنگ داره",
        target,
        wanted,
        contradiction
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "requested",
      itemEvidence: "پژو ۲۰۶",
      attributeEvidence: null,
      reason: "conflicting-target-side-attribute-evidence",
    });
  });

  it("does not treat a generic color mention as contradiction unless the caller explicitly supplies it", () => {
    expect(
      assessExchangeTargetEvidence(
        "موتور معاوضه با پژو ۲۰۶ رنگ نقره‌ای",
        target,
        wanted,
        contradiction
      )
    ).toMatchObject({
      status: "unknown",
      targetSide: "requested",
      itemEvidence: "پژو ۲۰۶",
      attributeEvidence: null,
      reason: "attribute-not-found-on-target-side",
    });
  });
});
