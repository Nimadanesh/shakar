"use client";

import { BellOff, Radar } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface RadarDialogProps {
  open: boolean;
  /** True when a kamin is already armed for this hunt. */
  armed: boolean;
  huntName: string;
  constraintCount: number;
  onArm: () => void;
  onDisarm: () => void;
  onClose: () => void;
}

/**
 * کمین arm/disarm. Honest about what monitoring is: local diffing on every
 * «شکار من» visit — no background watching, no push notifications yet.
 */
export function RadarDialog({
  open,
  armed,
  huntName,
  constraintCount,
  onArm,
  onDisarm,
  onClose,
}: RadarDialogProps) {
  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="کمین"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {armed ? (
              <BellOff size={18} aria-hidden="true" />
            ) : (
              <Radar size={18} aria-hidden="true" />
            )}
          </span>
          {armed ? "کمین فعال است" : "کمین برای این شکار"}
        </span>
      }
      subtitle={`«${huntName}» - ${constraintCount.toLocaleString("fa-IR")} قید فعال`}
      footer={
        armed ? (
          <button
            type="button"
            onClick={onDisarm}
            className="h-11 rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
          >
            غیرفعال کردن کمین
          </button>
        ) : (
          <button
            type="button"
            onClick={onArm}
            className="h-11 rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
          >
            فعال کردن کمین
          </button>
        )
      }
    >
      {armed ? (
        <p className="text-sm leading-7 text-muted-foreground">
          آگهی‌های تازه‌ی مطابق این شکار را در «شکار من» ← «تازه‌ها» می‌بینی.
        </p>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">
          قرار است لازم نباشد همین شکار را فردا از اول بسازی: هر بار «شکار
          من» را باز کنی، اگر آگهی تازه‌ای مطابق این شکار پیدا شود، در
          «تازه‌ها» می‌بینی. پایش پس‌زمینه و نوتیفیکیشن هنوز وصل نیست.
        </p>
      )}
    </BottomSheet>
  );
}
