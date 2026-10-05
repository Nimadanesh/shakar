"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title?: React.ReactNode;
  subtitle?: string;
  initialFocusRef?: React.RefObject<HTMLInputElement | null>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared bottom-sheet chrome: scrim, drag handle, 24px top radius,
 * spring-like entrance, Escape/backdrop dismissal, safe-area padding.
 * Content stays unopinionated so each surface keeps its own hierarchy.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  title,
  subtitle,
  initialFocusRef,
  children,
  footer,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    initialFocusRef?.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof label === "string" ? label : undefined}
        className="animate-rise relative flex max-h-[85dvh] w-full max-w-screen-sm flex-col gap-5 overflow-y-auto rounded-t-[24px] border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-[24px] sm:p-5"
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              {title && (
                <h2 className="text-[17px] font-semibold leading-7 text-foreground">{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="بستن"
              onClick={onClose}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground",
                "transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              )}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
        {footer}
      </div>
    </div>
  );
}
