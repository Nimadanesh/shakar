import "server-only";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { assessExchangeSides } from "./exchangeSides";

export type ExchangeTargetEvidenceStatus = "supported" | "unknown";

export interface ExchangeTargetEvidence {
  readonly status: ExchangeTargetEvidenceStatus;
  readonly targetSide: "offered" | "requested" | "unknown";
  readonly itemEvidence: string | null;
  readonly attributeEvidence: string | null;
  readonly reason: string;
}

/**
 * Conservative exact-phrase evidence check for a query's target item and
 * required attribute on an explicitly segmented exchange side.
 *
 * This helper does not extract entities, infer synonyms, or affect ranking.
 * Callers supply already-normalized phrase candidates. Missing attribute
 * evidence remains unknown, even when that phrase appears on the opposite
 * side. If item evidence occurs on both sides, ownership is ambiguous.
 */
export function assessExchangeTargetEvidence(
  text: string,
  targetItemPhrases: readonly string[],
  requiredAttributePhrases: readonly string[]
): ExchangeTargetEvidence {
  const sides = assessExchangeSides(text);
  if (sides.status === "unknown") {
    return {
      status: "unknown",
      targetSide: "unknown",
      itemEvidence: null,
      attributeEvidence: null,
      reason: `unsegmented:${sides.reason}`,
    };
  }

  const normalizedPhrases = (phrases: readonly string[]) =>
    [...new Set(phrases.map(normalizeForMatch).filter(Boolean))];

  const offered = sides.offeredText;
  const requested = sides.requestedText;
  const itemPhrases = normalizedPhrases(targetItemPhrases);
  const attributePhrases = normalizedPhrases(requiredAttributePhrases);

  const findPhrase = (side: string | null, phrases: readonly string[]) =>
    side === null ? null : phrases.find((phrase) => side.includes(phrase)) ?? null;

  const offeredItem = findPhrase(offered, itemPhrases);
  const requestedItem = findPhrase(requested, itemPhrases);

  if (offeredItem && requestedItem) {
    return {
      status: "unknown",
      targetSide: "unknown",
      itemEvidence: null,
      attributeEvidence: null,
      reason: "target-item-on-both-sides",
    };
  }

  const targetSide = offeredItem ? "offered" : requestedItem ? "requested" : "unknown";
  const targetText = targetSide === "offered" ? offered : targetSide === "requested" ? requested : null;
  const itemEvidence = offeredItem ?? requestedItem;

  if (!targetText || !itemEvidence) {
    return {
      status: "unknown",
      targetSide: "unknown",
      itemEvidence: null,
      attributeEvidence: null,
      reason: "target-item-not-found",
    };
  }

  const attributeEvidence = findPhrase(targetText, attributePhrases);
  if (!attributeEvidence) {
    const oppositeText = targetSide === "offered" ? requested : offered;
    const oppositeAttribute = findPhrase(oppositeText, attributePhrases);
    return {
      status: "unknown",
      targetSide,
      itemEvidence,
      attributeEvidence: null,
      reason: oppositeAttribute ? "attribute-only-on-opposite-side" : "attribute-not-found-on-target-side",
    };
  }

  return {
    status: "supported",
    targetSide,
    itemEvidence,
    attributeEvidence,
    reason: "item-and-attribute-on-same-side",
  };
}
