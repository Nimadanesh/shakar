"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfirmButtonProps {
  /** Idle label, e.g. «غیرفعال کردن». */
  label: string;
  /** Armed label, e.g. «مطمئنی؟ دوباره بزن». */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}

const ARM_TIMEOUT_MS = 3000;

/**
 * Two-step inline confirm for destructive actions: first tap arms
 * (destructive tint), second tap fires. A stray tap does nothing — the
 * armed state times out and reverts. No modal, no navigation loss.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function disarm() {
    setArmed(false);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function handleClick() {
    if (!armed) {
      setArmed(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(disarm, ARM_TIMEOUT_MS);
      return;
    }
    disarm();
    onConfirm();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className={cn(
        "h-11 w-full rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        armed
          ? "border-danger/60 bg-danger/10 text-danger"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
        className
      )}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
