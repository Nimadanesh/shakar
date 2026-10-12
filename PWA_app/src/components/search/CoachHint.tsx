"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface CoachSection {
  emoji: string;
  title: string;
  body?: string;
  example: string;
}

/** navid's coaching copy (2026-10-12): how to write a better hunt. */
const SECTIONS: CoachSection[] = [
  {
    emoji: "🎯",
    title: "برای نتیجه بهتر، دقیق‌تر بنویس",
    body: "فقط اسم کالا را ننویس؛ بگو چه چیزی، با چه ویژگی‌هایی، کجا و با چه قیمتی می‌خواهی.",
    example: "آپارتمان ۸۰ تا ۱۰۰ متری در سعادت‌آباد، آسانسور حتماً، طبقه اول نباشه، تا ۸ میلیارد",
  },
  {
    emoji: "✅",
    title: "اگر چیزی حتماً باید باشد",
    body: "از «حتماً» استفاده کن.",
    example: "لپ‌تاپ گیمینگ، RTX 4060 حتماً، رم ۱۶ گیگ، تا ۸۰ میلیون",
  },
  {
    emoji: "🚫",
    title: "اگر چیزی نمی‌خواهی",
    body: "بگو «بدون» یا «نباشه».",
    example: "آیفون ۱۳، بدون تعمیر، ۱۲۸ گیگ، تا ۵۰ میلیون",
  },
  {
    emoji: "⭐",
    title: "اگر ترجیح می‌دهی، ولی اجباری نیست",
    body: "از «ترجیحاً» استفاده کن.",
    example: "آپارتمان ۲ خوابه، آسانسور حتماً، ترجیحاً پارکینگ",
  },
  {
    emoji: "🏙️",
    title: "شهر و قیمت را بگو",
    example: "پژو ۲۰۷، مدل ۱۴۰۱ به بالا، تهران، تا ۱ میلیارد",
  },
  {
    emoji: "💡",
    title: "اسم دقیق کالا را نمی‌دانی؟",
    body: "اشکالی ندارد؛ همان‌طور که در ذهنت هست توضیحش بده.",
    example: "یه لپ‌تاپ سبک برای دانشگاه، ۱۴ اینچ، رم حداقل ۱۶، تا ۴۰ میلیون",
  },
];

const FORMULA = "چی می‌خوام + ویژگی مهم + بایدها + نباشدها + شهر + قیمت";

/**
 * Replaces the old suggested-hunts carousel: a single shimmer line
 * (AI-«thinking» style sweep) that opens the coaching bottom sheet.
 */
export function CoachHint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-start gap-2 rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]"
      >
        <span
          className="bg-clip-text text-[13px] font-medium text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)",
            backgroundSize: "200% 100%",
            animation: "shimmer-text 2.2s linear infinite",
          }}
        >
          چگونه شکار بهتری داشته باشیم؟
        </span>
        <Sparkles size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        label="چگونه شکار بهتری داشته باشیم؟"
        title="چگونه شکار بهتری داشته باشیم؟"
        subtitle="راهنمای نوشتن شکار دقیق‌تر"
      >
        <div className="flex flex-col gap-3">
          {SECTIONS.map((s) => (
            <section key={s.title} className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
                <span aria-hidden="true" className="text-[17px] leading-none">
                  {s.emoji}
                </span>
                {s.title}
              </h3>
              {s.body && (
                <p className="text-[13px] leading-6 text-muted-foreground">{s.body}</p>
              )}
              <p
                dir="auto"
                className="rounded-lg bg-secondary/60 px-3 py-2 text-[13px] leading-6 text-muted-foreground"
              >
                <span className="text-foreground/80">مثال: </span>
                {s.example}
              </p>
            </section>
          ))}
          <div className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[13px] leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">فرمول ساده: </span>
              <span dir="auto">{FORMULA}</span>
            </p>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
