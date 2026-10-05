/* ─────────────────────────────────────────────────────────
 * SKELETONS — for page/section loads that take perceptible time.
 *
 * Content-shaped: each skeleton mirrors the layout it stands in
 * for (rows for lists, cards for card grids). The triage results
 * skeleton lives in ResultsView (SkeletonList) next to its content.
 * ───────────────────────────────────────────────────────── */

function Pulse({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-secondary ${className ?? ""}`} />;
}

/** Stands in for a list row: icon dot + two text lines + chevron gap. */
export function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
    >
      <Pulse className="size-[15px] shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Pulse className="h-3.5 w-2/3 rounded-md" />
        <Pulse className="h-3 w-1/2 rounded-md" />
      </div>
      <Pulse className="size-[15px] shrink-0 rounded-full" />
    </div>
  );
}

/** Stands in for a rich card (kamin cards, stored hunt definitions). */
export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <Pulse className="h-4 w-3/4 rounded-md" />
      <Pulse className="h-4 w-1/2 rounded-md" />
      <Pulse className="h-16 w-full rounded-md" />
    </div>
  );
}
