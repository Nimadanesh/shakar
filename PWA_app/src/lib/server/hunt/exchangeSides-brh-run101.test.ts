import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { assessExchangeSides } from "./exchangeSides";

describe("BRH Run 101 — conservative exchange-side segmentation", () => {
  it("binds the wanted flatbed and its axle attribute to the requested side", () => {
    const result = assessExchangeSides("تریلی معاوضه با کفی سه محور");

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("تریلی"),
      requestedText: normalizeForMatch("کفی سه محور"),
    });
  });

  it("keeps an offered flatbed's attribute on the offered side", () => {
    const result = assessExchangeSides("کفی سه محور معاوضه با تانکر تمیز");

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("کفی سه محور"),
      requestedText: normalizeForMatch("تانکر تمیز"),
    });
  });

  it("does not transfer the requested tanker's axle attribute to the offered flatbed", () => {
    const result = assessExchangeSides("کفی معاوضه با تانکر سه محور");

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("کفی"),
      requestedText: normalizeForMatch("تانکر سه محور"),
    });
    expect(result.offeredText).not.toContain(normalizeForMatch("سه محور"));
  });

  it("keeps independently stated attributes on both sides", () => {
    const result = assessExchangeSides("کفی سه محور معاوضه با تانکر سه محور");

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("کفی سه محور"),
      requestedText: normalizeForMatch("تانکر سه محور"),
    });
  });

  it("preserves a requested side when the offered side is unstated", () => {
    expect(assessExchangeSides("معاوضه با کفی")).toMatchObject({
      status: "partial",
      offeredText: null,
      requestedText: normalizeForMatch("کفی"),
    });
  });

  it("does not guess side ownership when no explicit exchange boundary exists", () => {
    expect(assessExchangeSides("کفی سه محور تانکر تمیز")).toMatchObject({
      status: "unknown",
      offeredText: null,
      requestedText: null,
    });
  });

  it("declines ambiguous text with multiple exchange boundaries", () => {
    expect(
      assessExchangeSides("کفی معاوضه با تانکر معاوضه با تریلی")
    ).toMatchObject({
      status: "unknown",
      offeredText: null,
      requestedText: null,
      reason: "multiple-exchange-boundaries",
    });
  });

  it("preserves the actual P06 listing's offered/requested sides", () => {
    const result = assessExchangeSides("تریلی بیات معاوضه با کفی سه محور");

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("تریلی بیات"),
      requestedText: normalizeForMatch("کفی سه محور"),
    });
  });

  it("does not promote P07's requested tanker attribute to the offered flatbed", () => {
    const result = assessExchangeSides(
      "کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز"
    );

    expect(result).toMatchObject({
      status: "parsed",
      offeredText: normalizeForMatch("کفی اطلس ۱۲۶۰"),
      requestedText: normalizeForMatch("تانکر سه محور تمیز"),
    });
    expect(result.offeredText).not.toContain(normalizeForMatch("سه محور"));
  });

});
