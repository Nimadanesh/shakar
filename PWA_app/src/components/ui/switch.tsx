"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}

/** Soft iOS-style switch with clear accent on-state and accessible label. */
export function Switch({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hint ? `${label}. ${hint}` : label}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex flex-col items-start gap-0.5 text-start">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs leading-5 text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
          checked ? "justify-end border-transparent bg-action-primary pe-1" : "justify-start border-border bg-secondary ps-1"
        )}
      >
        <span className="size-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}
