"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

export interface InferredChip {
  id: string;
  label: string;
  value: string;
}

interface SpecChipsProps {
  title: string;
  hint: string;
  explicit: string[];
  inferred: InferredChip[];
  tone: "positive" | "negative";
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

/**
 * One specs section of the hunt form: explicit chips (solid, × removes)
 * plus inferred readings (dashed, tap to confirm, × dismisses), with an
 * inline add row. The form's chips ARE the interpretation surface.
 */
export function SpecChips({
  title,
  hint,
  explicit,
  inferred,
  tone,
  onAdd,
  onRemove,
  onConfirm,
  onDismiss,
}: SpecChipsProps) {
  const [draft, setDraft] = useState("");
  const accent = tone === "positive" ? "border-signal/30" : "border-danger/30";

  function commit() {
    const t = draft.trim();
    if (t === "" || explicit.includes(t)) {
      setDraft("");
      return;
    }
    onAdd(t);
    setDraft("");
  }

  return (
    <section aria-label={title} className={`flex flex-col gap-2.5 rounded-xl border ${accent} p-3.5`}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[13px] font-medium leading-5 text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>

      {(explicit.length > 0 || inferred.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {explicit.map((term) => (
            <span
              key={`explicit:${term}`}
              className="flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 text-[13px] text-foreground"
            >
              {term}
              <button
                type="button"
                onClick={() => onRemove(term)}
                aria-label={`حذف ${term}`}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {inferred.map((chip) => (
            <span
              key={chip.id}
              className="flex min-h-8 items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/60 bg-transparent px-2.5 text-[13px] text-muted-foreground"
            >
              <button
                type="button"
                onClick={() => onConfirm(chip.id)}
                aria-label={`تأیید: ${chip.label}`}
                className="flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Check size={13} aria-hidden="true" />
                {chip.label}
                <span className="text-[11px] text-muted-foreground/80">حدسی</span>
              </button>
              <button
                type="button"
                onClick={() => onDismiss(chip.id)}
                aria-label={`نادیده گرفتن ${chip.label}`}
                className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="بنویس و Enter بزن…"
          aria-label={`افزودن به ${title}`}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim() === ""}
          aria-label={`افزودن به ${title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
