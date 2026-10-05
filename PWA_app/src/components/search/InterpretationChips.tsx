"use client";

import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InterpretationChip {
  id: string;
  label: string;
  inferred?: boolean;
}

export interface InterpretationGroup {
  id: string;
  title: string;
  chips: InterpretationChip[];
}

interface InterpretationChipsProps {
  groups: InterpretationGroup[];
  preferences: Array<{ id: string; label: string }>;
  onRemoveChip: (chipId: string) => void;
  onPromoteChip: (chipId: string) => void;
  onPromotePreference: (id: string) => void;
}

/**
 * THE single interpretation surface: everything Shakar understood from the
 * user's words, explicit and inferred side by side. Explicit chips are
 * solid; inferred readings are dashed («حدسی») — tap one to confirm it,
 * X to dismiss. Nothing lives in a second panel.
 */
export function InterpretationChips({
  groups,
  preferences,
  onRemoveChip,
  onPromoteChip,
  onPromotePreference,
}: InterpretationChipsProps) {
  const visibleGroups = groups.filter((g) => g.chips.length > 0);
  if (visibleGroups.length === 0 && preferences.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="برداشت از جستجو"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
    >
      <p className="text-[13px] leading-5 text-foreground">
        <span className="font-medium">از حرفت فهمیدم</span>
        <span className="ms-2 font-normal text-muted-foreground">
          چین‌دارها حدسی‌ان — بزن تأیید بشن
        </span>
      </p>

      {visibleGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1.5">
          <p className="text-xs leading-5 text-muted-foreground">{group.title}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.chips.map((chip) => {
              const label = chip.label.replace(/^حذف:\s*/, "");
              return (
                <span
                  key={chip.id}
                  className={cn(
                    "flex min-h-9 items-center gap-1 rounded-full border py-1 ps-3 pe-1 text-[13px] leading-5",
                    chip.inferred
                      ? "border-dashed border-border text-muted-foreground"
                      : "border-border bg-secondary/60 text-foreground"
                  )}
                >
                  {chip.inferred ? (
                    <button
                      type="button"
                      onClick={() => onPromoteChip(chip.id)}
                      aria-label={`تأیید «${label}» به‌عنوان فیلتر قطعی`}
                      className="flex min-h-7 items-center gap-1 rounded-full font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Check size={13} aria-hidden="true" className="shrink-0 text-primary" />
                      {label}
                    </button>
                  ) : (
                    <span className="font-medium">{label}</span>
                  )}
                  {chip.inferred && (
                    <span className="rounded-full bg-secondary px-1.5 text-[11px] leading-4 text-muted-foreground">
                      حدسی
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveChip(chip.id)}
                    aria-label={`حذف «${label}»`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
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
    </section>
  );
}
