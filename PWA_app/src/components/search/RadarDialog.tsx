"use client";

import { Radar } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { RadarConfig } from "@/lib/radar";

interface RadarDialogProps {
  open: boolean;
  radar: RadarConfig | null;
  onClose: () => void;
}

/**
 * کمین direction preview. Monitoring has no backend in this phase, so this
 * dialog designs the interaction honestly: it names the hunt that WOULD be
 * watched and states plainly that watching is not connected yet. No fake
 * activation, no invented notification promises.
 */
export function RadarDialog({ open, radar, onClose }: RadarDialogProps) {
  if (!open || !radar) return null;

  const constraintCount =
    radar.context.includeKeywords.length +
    radar.context.excludeKeywords.length +
    (radar.context.city !== "all" ? 1 : 0) +
    (radar.context.category !== "all" ? 1 : 0) +
    (radar.context.priceMin !== null || radar.context.priceMax !== null ? 1 : 0);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="کمین"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Radar size={18} aria-hidden="true" />
          </span>
          کمین برای این شکار
        </span>
      }
      subtitle={`«${radar.name}» - ${constraintCount.toLocaleString("fa-IR")} قید فعال`}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          باشه، فهمیدم
        </button>
      }
    >
      <p className="text-sm leading-7 text-muted-foreground">
        قرار است لازم نباشد همین جستجو را فردا دوباره انجام بدهی: اگر آگهی
        تازه‌ای مطابق همین شکار پیدا شود، خبرت می‌کنیم. این قابلیت هنوز به
        سامانه پایش وصل نیست؛ معماری آن آماده است و به‌زودی فعال می‌شود.
      </p>
    </BottomSheet>
  );
}
