"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InferredRow {
  id: string;
  label: string;
}

export interface MeaningGroup {
  id: string;
  title: string;
  rows: InferredRow[];
}

interface SearchMeaningProps {
  query: string;
  groups: MeaningGroup[];
  preferences: Array<{ id: string; label: string }>;
  onDismissRow: (rowId: string) => void;
  onPromoteRow: (rowId: string) => void;
  onPromotePreference: (id: string) => void;
}

/**
 * Interpretation layer: what Shakar understood from the user's words.
 * Only inferred readings live here — explicit user refinements live in the
 * Active Search Summary, so nothing repeats. Renders nothing at all when
 * nothing was inferred beyond the raw query. Collapsible to a single row.
 */
export function SearchMeaning({
  query,
  groups,
  preferences,
  onDismissRow,
  onPromoteRow,
  onPromotePreference,
}: SearchMeaningProps) {
  const visibleGroups = groups.filter((g) => g.rows.length > 0);
  const [expanded, setExpanded] = useState(true);
  if (visibleGroups.length === 0 && preferences.length === 0) {
    return null;
  }
  const collapsedSummary = [
    ...visibleGroups.flatMap((g) => g.rows.map((r) => r.label)),
    ...preferences.map((p) => `ترجیح ${p.label}`),
  ]
    .slice(0, 3)
    .join("، ");

  return (
    <section
      aria-label="برداشت از جستجو"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-ring",
          expanded && "border-b border-border-subtle"
        )}
      >
        <span className="text-[13px] font-medium leading-5 text-foreground">
          از حرفت فهمیدم
        </span>
        {expanded ? (
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="ms-auto shrink-0 rotate-180 text-muted-foreground transition-transform"
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-xs leading-5 text-muted-foreground">
              {collapsedSummary}
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground transition-transform"
            />
          </>
        )}
      </button>

      {expanded && (
        <div className="animate-rise flex flex-col gap-4 p-3">
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            <span>جستجو: </span>«{query}»
          </p>

          {visibleGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <p className="text-[13px] leading-5 text-muted-foreground">{group.title}</p>
              <ul className="flex flex-col gap-1.5">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 text-[13px] leading-5"
                  >
                    <span className="font-medium text-foreground">{row.label}</span>
                    <span className="rounded-full bg-secondary px-1.5 text-[11px] leading-4 text-muted-foreground">
                      حدسی
                    </span>
                    <span className="flex-1" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => onPromoteRow(row.id)}
                      aria-label={`تأیید ${row.label} به‌عنوان فیلتر قطعی`}
                      className="flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Check size={13} aria-hidden="true" />
                      تأیید
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissRow(row.id)}
                      aria-label={`حذف ${row.label} از برداشت`}
                      className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring after:absolute after:-inset-2 after:content-['']"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {preferences.map((pref) => (
            <div
              key={pref.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2"
            >
              <p className="text-[13px] leading-5 text-muted-foreground">
                ترجیح: «{pref.label}» — فیلتر نیست
              </p>
              <button
                type="button"
                onClick={() => onPromotePreference(pref.id)}
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Plus size={14} aria-hidden="true" />
                شامل کن
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
