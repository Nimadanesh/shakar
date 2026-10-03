"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { normalizeKeyword } from "@/lib/keywords";
import { cn } from "@/lib/utils";

interface KeywordChipsProps {
  id: string;
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  tone: "include" | "exclude";
}

export function KeywordChips({ id, label, placeholder, values, onChange, tone }: KeywordChipsProps) {
  const [draft, setDraft] = useState("");
  const Icon = tone === "include" ? Plus : Minus;

  function commit() {
    const term = normalizeKeyword(draft);
    if (term === "" || values.includes(term)) {
      setDraft("");
      return;
    }
    onChange([...values, term].slice(0, 20));
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "،") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-foreground"
      >
        <Icon size={14} aria-hidden="true" className="text-muted-foreground" />
        {label}
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-muted/40 px-3 py-2 focus-within:border-ring">
        {values.map((term) => (
          <span
            key={term}
            className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pe-1.5 ps-2.5 text-xs leading-4 text-foreground"
          >
            {term}
            <button
              type="button"
              aria-label={`حذف ${term}`}
              onClick={() => onChange(values.filter((v) => v !== term))}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-label={label}
          className={cn(
            "h-7 min-w-24 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          )}
        />
      </div>
    </div>
  );
}
