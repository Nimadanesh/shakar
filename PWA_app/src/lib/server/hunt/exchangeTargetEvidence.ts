import "server-only";

import { normalizeForMatch } from "@/lib/persianNormalize";
import { assessExchangeSides } from "./exchangeSides";

export type ExchangeTargetEvidenceStatus = "supported" | "contradicted" | "unknown";

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
 * Callers supply explicit phrase candidates for both supporting and
 * contradicting evidence. This remains phrase-level diagnostics, not natural
 * language inference: callers must not use generic tokens such as «رنگ» as
 * contradiction phrases. Missing evidence remains unknown, even when a phrase
 * appears on the opposite side. If item evidence occurs on both sides,
 * ownership is ambiguous.
 */
export function assessExchangeTargetEvidence(
  text: string,
  targetItemPhrases: readonly string[],
  requiredAttributePhrases: readonly string[],
  contradictingAttributePhrases: readonly string[] = []
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
  const contradictionPhrases = normalizedPhrases(contradictingAttributePhrases);

  // Match complete normalized tokens/phrases, not arbitrary substrings.
  // For example, «کفی‌سازی» must not count as the item «کفی», and
  // «سه محوری» must not silently satisfy the attribute «سه محور».
  const findPhrase = (side: string | null, phrases: readonly string[]) => {
    if (side === null) return null;
    const paddedSide = ` ${side} `;
    // Prefer the most specific exact phrase when caller-supplied candidates
    // overlap (for example, "کفی" and "کفی سه محور"). This avoids making
    // evidence selection depend on candidate-array order without adding
    // stemming, synonym inference, or fuzzy matching.
    return (
      phrases

        .filter((phrase) => paddedSide.includes(` ${phrase} `))
        .sort((a, b) => b.length - a.length)[0] ?? null
    );
  };

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
  const contradictionEvidence = findPhrase(targetText, contradictionPhrases);

  if (attributeEvidence && contradictionEvidence) {
    return {
      status: "unknown",
      targetSide,
      itemEvidence,
      attributeEvidence: null,
      reason: "conflicting-target-side-attribute-evidence",
    };
  }

  if (contradictionEvidence) {
    return {
      status: "contradicted",
      targetSide,
      itemEvidence,
      attributeEvidence: contradictionEvidence,
      reason: "target-side-attribute-explicitly-contradicted",
    };
  }

  if (!attributeEvidence) {
    const oppositeText = targetSide === "offered" ? requested : offered;
    const oppositeAttribute =
      findPhrase(oppositeText, attributePhrases) ??
      findPhrase(oppositeText, contradictionPhrases);
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
