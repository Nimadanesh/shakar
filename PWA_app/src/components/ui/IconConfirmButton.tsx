"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconConfirmButtonProps {
  /** Accessible label, e.g. «حذف شکار». */
  label: string;
  onConfirm: () => void;
  className?: string;
}

const ARM_TIMEOUT_MS = 3000;

/**
 * Icon-only two-step confirm for destructive row actions. First tap arms
 * (danger tint + wider hit area stays), second tap fires. A stray tap does
 * nothing — the armed state times out and reverts. Mirrors ConfirmButton.
 */
export function IconConfirmButton({
  label,
  onConfirm,
  className,
}: IconConfirmButtonProps) {
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

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
      aria-label={armed ? `${label} — برای تأیید دوباره بزن` : label}
      aria-live="polite"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        armed
          ? "bg-danger/10 text-danger"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}
