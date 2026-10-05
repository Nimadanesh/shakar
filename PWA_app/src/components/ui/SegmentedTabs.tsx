"use client";

import { cn } from "@/lib/utils";

export interface SegmentTab {
  id: string;
  label: string;
  /** Real count shown next to the label; omitted when undefined. */
  count?: number;
}

interface SegmentedTabsProps {
  tabs: SegmentTab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/**
 * In-page segmented tab bar. One tab is always visible; switching is one tap.
 * Active tab = tinted surface + foreground text (never a solid fill, per
 * designSystem §4). Counts are real, never invented.
 */
export function SegmentedTabs({ tabs, active, onChange, ariaLabel }: SegmentedTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex rounded-lg bg-secondary/60 p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "shrink-0 text-[12px] tabular-nums",
                  selected ? "text-muted-foreground" : "text-muted-foreground/70"
                )}
              >
                ({tab.count.toLocaleString("fa-IR")})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
