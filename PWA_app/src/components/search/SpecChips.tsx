"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypoNudge, TYPO_PAUSE_MS } from "@/components/search/TypoNudge";
import { applyTypoFixToText } from "@/lib/persianTypos";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export interface InferredChip {
  id: string;
  label: string;
  value: string;
}

interface SpecChipsProps {
  title: string;
  /** Single-line subtitle — shows, doesn't explain. */
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
 *
 * Visual (2026-10-18 redesign): flat — no nested box. The section's
 * identity comes from a 3px colored edge bar (signal/danger) instead of
 * a tinted header panel. Teaching happens in the input placeholder,
 * not in a guide paragraph.
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
  // Same anti-nag rule as the «چی؟» field: never interrupt the word being
  // typed — the nudge fires for finished words, or a paused last word.
  const settledDraft = useDebouncedValue(draft, TYPO_PAUSE_MS);
  const positive = tone === "positive";
  const titleColor = positive ? "text-signal" : "text-danger";
  const barColor = positive ? "bg-signal" : "bg-danger";
  // Teaching placeholder per section — the three-word version of the old
  // guide paragraph.
  const placeholder = positive ? "مثلاً حافظه ۱۲۸ گیگ" : "مثلاً تعمیر شده";

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
    <section aria-label={title} className="relative ps-4">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-[3px] start-0 w-[3px] rounded-full",
          barColor
        )}
      />
      <p className={cn("text-[15px] font-bold leading-6", titleColor)}>
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
        {hint}
      </p>

      {(explicit.length > 0 || inferred.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {explicit.map((term) => (
            <span
              key={`explicit:${term}`}
              className="flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 text-[13px] text-foreground"
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
              className="flex min-h-8 items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/60 bg-transparent px-2.5 text-[13px] text-muted-foreground"
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

      <div className="mt-3 flex items-center gap-2.5">
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
          placeholder={placeholder}
          aria-label={`افزودن به ${title}`}
          className="h-12 min-w-0 flex-1 rounded-[14px] border border-border bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim() === ""}
          aria-label={`افزودن به ${title}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      {positive && (
        <p className="mt-2.5 text-[11px] leading-6 text-muted-foreground/80">
          کلمات «چی؟» خودکار لحاظ می‌شن — اینجا فقط اضافه بذار.
        </p>
      )}
      {/* Typo tolerance for the add-row too: typos happen in filters as
          well as in «چی؟». One tap fixes the draft; Enter still adds it. */}
      <TypoNudge
        query={draft}
        typingPaused={draft === settledDraft}
        onApplyFix={(originalToken, fixed) =>
          setDraft((d) => applyTypoFixToText(d, originalToken, fixed))
        }
      />
    </section>
  );
}
