"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { normalizeKeyword } from "@/lib/keywords";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

interface KeywordChipsProps {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
  values: string[];
  suggestions: string[];
  tone?: ChipTone;
  onChange: (values: string[]) => void;
}

export function KeywordChips({
  id,
  label,
  helper,
  placeholder,
  values,
  suggestions,
  tone = "neutral",
  onChange,
}: KeywordChipsProps) {
  const [draft, setDraft] = useState("");
  const freshSuggestions = suggestions.filter((s) => !values.includes(s)).slice(0, 4);

  function addTerm(raw: string) {
    const term = normalizeKeyword(raw);
    if (term === "" || values.includes(term)) {
      setDraft("");
      return;
    }
    onChange([...values, term].slice(0, 20));
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter commits. Comma is intentionally NOT a commit key: it conflicts
    // with Persian typing (SEARCH-WORKSPACE-SPEC-V1 §10.3).
    if (event.key === "Enter") {
      event.preventDefault();
      addTerm(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-foreground"
        >
          {tone !== "neutral" && (
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                tone === "positive" ? "bg-signal" : "bg-danger"
              )}
            />
          )}
          {label}
        </label>
        <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
      </div>
      {freshSuggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs leading-4 text-muted-foreground">پیشنهاد:</p>
          <div className="flex flex-wrap gap-1.5" aria-label={`پیشنهادها برای ${label}`}>
            {freshSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTerm(suggestion)}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs leading-4 text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Plus size={12} aria-hidden="true" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 focus-within:border-ring">
        {values.map((term) => (
          <Chip
            key={term}
            tone={tone}
            onRemove={() => onChange(values.filter((v) => v !== term))}
            removeLabel={`حذف ${term}`}
          >
            {term}
          </Chip>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-label={label}
          className={cn(
            "h-7 min-w-24 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          )}
        />
        {draft.trim() !== "" && (
          <button
            type="button"
            onClick={() => addTerm(draft)}
            className="flex h-8 shrink-0 items-center rounded-lg bg-action-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring"
          >
            افزودن
          </button>
        )}
      </div>
    </div>
  );
}
