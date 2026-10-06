import type { FixtureAd } from "@/data/search-fixtures";
import { adSearchText, includesTerm, stripQuotes } from "@/lib/search";
import type { SearchContext } from "@/types/search";

interface WhyMatchedProps {
  ad: FixtureAd;
  ctx: SearchContext;
}

/**
 * «چرا این آگهی نمایش داده شده؟» — Shekaar's signature verification surface.
 * Every row is factual evidence from the listing text:
 * - include terms actually detected → signal
 * - excluded terms verified absent → signal
 * - an excluded term FOUND in the text → warning (negative evidence, factual:
 *   detection only, never a conclusion about the item itself)
 * «تطابق بالا» appears only when every include term is detected and every
 * excluded term is verified absent — never a strong treatment with
 * unresolved requirements. Renders nothing when there is no evidence
 * context (direct link / favorites entry): evidence is never invented.
 */
export function WhyMatched({ ad, ctx }: WhyMatchedProps) {
  const display = (raw: string) => stripQuotes(raw).phrase;

  const includeTerms = ctx.includeKeywords.filter((t) => display(t) !== "");
  const excludeTerms = ctx.excludeKeywords.filter((t) => display(t) !== "");
  if (includeTerms.length === 0 && excludeTerms.length === 0) return null;

  const text = adSearchText(ad);
  const present = includeTerms.filter((t) => includesTerm(text, t));
  const absentExcluded = excludeTerms.filter((t) => !includesTerm(text, t));
  const conflictExcluded = excludeTerms.filter((t) => includesTerm(text, t));
  if (present.length === 0 && absentExcluded.length === 0 && conflictExcluded.length === 0) {
    return null;
  }

  const strongMatch =
    includeTerms.length > 0 &&
    present.length === includeTerms.length &&
    conflictExcluded.length === 0;

  return (
    <section
      aria-label="چرا این آگهی نمایش داده شده"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold leading-6 text-foreground">
          چرا این آگهی نمایش داده شده؟
        </h2>
        {strongMatch && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-signal-soft px-2 py-0.5 text-[12px] font-medium leading-5 text-signal">
            <span aria-hidden="true">✓</span>
            تطابق بالا
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2.5">
        {present.map((term) => (
          <li key={`p-${term}`} className="flex items-start gap-2 text-sm leading-6">
            <span aria-hidden="true" className="font-semibold text-signal">
              ✓
            </span>
            <span className="flex-1">
              <span className="font-medium text-foreground">«{display(term)}»</span>{" "}
              <span className="text-muted-foreground">در متن آگهی دیده شد</span>
            </span>
            <span className="shrink-0 text-[11px] leading-6 text-muted-foreground">
              شناسایی‌شده
            </span>
          </li>
        ))}
        {absentExcluded.map((term) => (
          <li key={`a-${term}`} className="flex items-start gap-2 text-sm leading-6">
            <span aria-hidden="true" className="font-semibold text-signal">
              ✓
            </span>
            <span className="flex-1">
              <span className="font-medium text-foreground">«{display(term)}»</span>{" "}
              <span className="text-muted-foreground">در متن دیده نشد</span>
            </span>
            <span className="shrink-0 text-[11px] leading-6 text-muted-foreground">
              شناسایی‌شده
            </span>
          </li>
        ))}
        {conflictExcluded.map((term) => (
          <li key={`c-${term}`} className="flex flex-col gap-1 text-sm leading-6">
            <span className="flex items-start gap-2">
              <span aria-hidden="true" className="font-semibold text-warning">
                ؟
              </span>
              <span className="flex-1">
                <span className="font-medium text-foreground">«{display(term)}»</span>{" "}
                <span className="text-muted-foreground">در توضیحات دیده شد</span>
              </span>
            </span>
            <span className="ps-6 text-[12px] leading-5 text-warning">
              این با فیلتر حذف شما مغایرت دارد — صرفاً شناسایی شده، نه نتیجه‌گیری.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
