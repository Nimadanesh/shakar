import Image from "next/image";
import { ImageOff } from "lucide-react";

interface AdDetailGalleryProps {
  images: string[];
  thumbnail?: string;
  title: string;
}

/**
 * Verification gallery: real listing imagery at its source aspect ratio,
 * swipeable on mobile when there are several. No decorative manipulation.
 * When the source exposes nothing, an honest empty state — never a fake photo.
 */
export function AdDetailGallery({ images, thumbnail, title }: AdDetailGalleryProps) {
  const all = images.length > 0 ? images : thumbnail ? [thumbnail] : [];

  if (all.length === 0) {
    return (
      <div
        role="img"
        aria-label="تصویری برای این آگهی ثبت نشده است"
        className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-lg bg-secondary text-muted-foreground"
      >
        <ImageOff size={32} aria-hidden="true" />
        <p className="text-[13px] leading-5">تصویری ثبت نشده</p>
      </div>
    );
  }

  if (all.length === 1) {
    return (
      <figure className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-secondary">
        <Image
          src={all[0]}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 640px"
          priority
        />
      </figure>
    );
  }

  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg"
      aria-label="گالری تصاویر آگهی"
    >
      {all.map((src, index) => (
        <figure
          key={`${index}-${src.slice(0, 24)}`}
          className="relative aspect-[16/10] w-full shrink-0 snap-center overflow-hidden rounded-lg bg-secondary"
        >
          <Image
            src={src}
            alt={index === 0 ? title : `${title} — تصویر ${index + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 640px"
            priority={index === 0}
          />
        </figure>
      ))}
    </div>
  );
}
