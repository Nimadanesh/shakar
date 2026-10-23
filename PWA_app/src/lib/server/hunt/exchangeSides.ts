import "server-only";

import { normalizeForMatch } from "@/lib/persianNormalize";

/**
 * Conservative segmentation for the explicit Persian exchange construction
 * «OFFERED معاوضه با REQUESTED».
 *
 * This is deliberately not an entity parser: each side remains a normalized
 * text span, and attributes must only be checked against the span they occur
 * in. Ambiguous grammar and multiple exchange markers stay unknown.
 */
export type ExchangeSideStatus = "parsed" | "partial" | "unknown";

export interface ExchangeSideAssessment {
  readonly status: ExchangeSideStatus;
  readonly offeredText: string | null;
  readonly requestedText: string | null;
  readonly reason: string;
}

export function assessExchangeSides(text: string): ExchangeSideAssessment {
  const normalized = normalizeForMatch(text);
  if (!normalized) {
    return {
      status: "unknown",
      offeredText: null,
      requestedText: null,
      reason: "empty-text",
    };
  }

  const marker = /\s+معاوضه\s+با\s+/g;
  const matches = [...normalized.matchAll(marker)];
  if (matches.length > 1) {
    return {
      status: "unknown",
      offeredText: null,
      requestedText: null,
      reason: "multiple-exchange-boundaries",
    };
  }

  // Also support a leading «معاوضه با X»: only the requested side is known.
  if (normalized.startsWith("معاوضه با ")) {
    const requestedText = normalized.slice("معاوضه با ".length).trim();
    return requestedText
      ? {
          status: "partial",
          offeredText: null,
          requestedText,
          reason: "requested-side-only",
        }
      : {
          status: "unknown",
          offeredText: null,
          requestedText: null,
          reason: "empty-requested-side",
        };
  }

  if (matches.length === 0) {
    return {
      status: "unknown",
      offeredText: null,
      requestedText: null,
      reason: "no-explicit-exchange-boundary",
    };
  }

  const match = matches[0];
  const index = match.index ?? -1;
  if (index < 0) {
    return {
      status: "unknown",
      offeredText: null,
      requestedText: null,
      reason: "unresolved-exchange-boundary",
    };
  }

  const offeredText = normalized.slice(0, index).trim();
  const requestedText = normalized.slice(index + match[0].length).trim();
  if (offeredText && requestedText) {
    return {
      status: "parsed",
      offeredText,
      requestedText,
      reason: "explicit-offered-requested-boundary",
    };
  }
  if (offeredText) {
    return {
      status: "partial",
      offeredText,
      requestedText: null,
      reason: "offered-side-only",
    };
  }
  if (requestedText) {
    return {
      status: "partial",
      offeredText: null,
      requestedText,
      reason: "requested-side-only",
    };
  }
  return {
    status: "unknown",
    offeredText: null,
    requestedText: null,
    reason: "empty-exchange-sides",
  };
}
