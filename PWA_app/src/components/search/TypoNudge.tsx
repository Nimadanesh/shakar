"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { normalizePersian } from "@/lib/normalizePersian";
import { suggestTypoFix } from "@/lib/persianTypos";

interface TypoNudgeProps {
  query: string;
  /** Replace the first occurrence of the original token with the fix. */
  onApplyFix: (originalToken: string, fixed: string) => void;
}

const norm = (t: string) => normalizePersian(t).replace(/‌/g, "");

interface TypoHit {
  token: string;
  word: string;
  fix: string;
}

/** First suspicious word in the query, if any. Cheap — no memo needed. */
function findTypoHit(query: string): TypoHit | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  for (const token of trimmed.split(/\s+/)) {
    const word = norm(token);
    const fix = suggestTypoFix(word);
    if (fix) return { token, word, fix };
  }
  return null;
}

/**
 * One-tap typo correction, shown under the «چی؟» field while typing.
 * Fires only when a typed word is unknown but a 1-edit neighbor is a known
 * word (e.g. «نورکیر» → «نورگیر»). Dismissible per word, never
 * auto-applies, and costs zero quota — it runs before the hunt fires.
 */
export function TypoNudge({ query, onApplyFix }: TypoNudgeProps) {
  const [dismissedWord, setDismissedWord] = useState<string | null>(null);

  const hit = findTypoHit(query);
  if (!hit || dismissedWord === hit.word) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <p className="text-[13px] leading-5 text-muted-foreground">
        «<span className="text-foreground">{hit.word}</span>» اشتباه تایپی به
        نظر می‌رسه — منظورت «
        <span className="font-medium text-foreground">{hit.fix}</span>» بود؟
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onApplyFix(hit.token, hit.fix)}
          className="min-h-9 shrink-0 rounded-lg bg-action-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
        >
          آره، اصلاح کن
        </button>
        <button
          type="button"
          aria-label="بی‌خیال"
          onClick={() => setDismissedWord(hit.word)}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
