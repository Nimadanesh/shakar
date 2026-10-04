import { Car, Home, Music, Package, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, typeof Music> = {
  music: Music,
  vehicles: Car,
  "real-estate": Home,
  mobile: Smartphone,
};

/** Honest missing-image state: branded category surface, never a broken look. */
export function CategoryArt({
  categoryId,
  title,
  className,
}: {
  categoryId: string | undefined;
  title: string;
  className?: string;
}) {
  const Icon = (categoryId !== undefined ? CATEGORY_ICONS[categoryId] : undefined) ?? Package;
  return (
    <div
      role="img"
      aria-label={`بدون تصویر برای ${title}`}
      className={cn(
        "flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 bg-secondary text-muted-foreground",
        className
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full border border-border bg-card">
        <Icon size={26} aria-hidden="true" strokeWidth={1.5} />
      </span>
      <span className="text-[11px] leading-4">بدون تصویر</span>
    </div>
  );
}
