"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back from an ad's detail page — a POP, not a link.
 *
 * The ad is pushed on top of wherever the hunter came from (a hunt's
 * results, favorites, …), so leaving must pop back to that exact page.
 * The old <Link href="/results/…"> PUSHED a duplicate results entry:
 * [..., archive, results/A, ad, results/A] — and the results page's own
 * «بازگشت» (router.back) then landed on the ad instead of the archive
 * (navid 2026-10-08). Deep links with no history fall back to fallbackHref.
 */
export function AdBackButton({
  fallbackHref,
  label,
  className,
  iconSize = 16,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
  iconSize?: number;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      <ArrowRight size={iconSize} aria-hidden="true" />
      {label}
    </button>
  );
}
