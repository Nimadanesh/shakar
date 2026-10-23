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
