import { normalizePersian } from "@/lib/normalizePersian";
import { stripQuotes } from "@/lib/search";

interface Segment {
  text: string;
  hit: boolean;
}

/**
 * Marks include-term hits across the FULL seller description.
 * The seller's copy stays intact — hits are only highlighted, never rewritten.
 * Same normalized-matching approximation as lib/search excerptSegments.
 */
function highlightSegments(source: string, terms: string[]): Segment[] {
  const phrases = terms
    .map((t) => stripQuotes(t).phrase)
    .filter((t) => t !== "");
  if (phrases.length === 0) return [{ text: source, hit: false }];

  const lowered = normalizePersian(source);
  const ranges: Array<[number, number]> = [];
  for (const phrase of phrases) {
    let at = lowered.indexOf(phrase);
    while (at >= 0) {
      ranges.push([at, at + phrase.length]);
      at = lowered.indexOf(phrase, at + phrase.length);
    }
  }
  if (ranges.length === 0) return [{ text: source, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [from, to] of ranges) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) {
      last[1] = Math.max(last[1], to);
    } else {
      merged.push([from, to]);
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    if (from > cursor) segments.push({ text: source.slice(cursor, from), hit: false });
    if (to > cursor)
      segments.push({ text: source.slice(Math.max(from, cursor), to), hit: true });
    cursor = Math.max(cursor, to);
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), hit: false });
  return segments;
}

interface DescriptionEvidenceProps {
  description: string;
  includeTerms: string[];
}

export function DescriptionEvidence({ description, includeTerms }: DescriptionEvidenceProps) {
  const text = description.trim();
  if (text === "") return null;
  const segments = highlightSegments(text, includeTerms);

  return (
    <section aria-label="توضیحات آگهی" className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold leading-6 text-foreground">
        توضیحات فروشنده
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">
        {segments.map((segment, index) =>
          segment.hit ? (
            <mark key={index} className="bg-transparent font-medium text-signal">
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
      </p>
    </section>
  );
}
