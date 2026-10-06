"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { normalizePersian } from "@/lib/normalizePersian";
import { suggestTypoFix } from "@/lib/persianTypos";

/**
 * Pause after the last keystroke before the word being typed counts as
 * finished. Long enough to never fire between normal keystrokes on a
 * Persian mobile keyboard, short enough to feel responsive.
 */
export const TYPO_PAUSE_MS = 1200;

interface TypoNudgeProps {
  query: string;
  /**
   * True once the user has stopped typing (parent debounces the query by
   * TYPO_PAUSE_MS and passes query === debouncedQuery). The nudge must
   * never interrupt the word being formed — see findTypoHit.
   */
  typingPaused: boolean;
  /** Replace the first occurrence of the original token with the fix. */
  onApplyFix: (originalToken: string, fixed: string) => void;
}

const norm = (t: string) => normalizePersian(t).replace(/‌/g, "");

interface TypoHit {
  token: string;
  word: string;
  fix: string;
}

/**
 * Natural typing behavior model (Persian mobile keyboards):
 *
 * 1. While a word is being formed — no trailing space and keystrokes still
 *    coming — it is NOT a typo, it is an unfinished word. Interrupting it
 *    with "did you mean …?" is exactly the phone-autocorrect nagging users
 *    hate. The word being typed is never nudged.
 * 2. A word followed by a space is finished — fair game, nudge immediately.
 * 3. The last word with no trailing space counts as finished only once the
 *    user pauses (typingPaused): they stopped, so they likely meant what
 *    they typed. This is what makes single-word queries («پین») work
 *    without nagging fast typists mid-word.
 *
 * Cheap — no memo needed.
 */
export function findTypoHit(query: string, typingPaused: boolean): TypoHit | null {
  const hasTrailingSpace = /\s$/.test(query);
  const tokens = query.split(/\s+/).filter((t) => t !== "");
  for (let i = 0; i < tokens.length; i++) {
    const isLast = i === tokens.length - 1;
    if (isLast && !hasTrailingSpace && !typingPaused) continue; // still forming it
    const word = norm(tokens[i]);
    const fix = suggestTypoFix(word);
    if (fix) return { token: tokens[i], word, fix };
  }
  return null;
}

/**
 * A dismissal stands only while its word is still part of the query text.
 * Clearing the field (or moving to another word) gives the nudge a fresh
 * chance — a dismissal must never silence a word for the whole session.
 * That was the real "sometimes it works, sometimes it doesn't" bug.
 */
export function isTypoDismissed(
  query: string,
  dismissedWord: string | null,
  hitWord: string | null
): boolean {
  return (
    dismissedWord !== null &&
    hitWord === dismissedWord &&
    norm(query).includes(dismissedWord)
  );
}

/**
 * One-tap typo correction under a hunt text field. Fires only for FINISHED
 * words (see findTypoHit) whose near neighbor is a known word (e.g.
 * «نورکیر» → «نورگیر», «پین» → «پیانو» once the user pauses). Dismissible
 * per word, never auto-applies, costs zero quota — it runs before the hunt
 * fires, and never interrupts the word being typed.
 */
export function TypoNudge({ query, typingPaused, onApplyFix }: TypoNudgeProps) {
  const [dismissedWord, setDismissedWord] = useState<string | null>(null);

  const hit = findTypoHit(query, typingPaused);
  if (!hit || isTypoDismissed(query, dismissedWord, hit.word)) return null;

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
