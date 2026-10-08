"use client";

/**
 * Price with a de-emphasized currency unit (navid 2026-10-08): the number
 * is the signal, «تومان» is just the unit — half the size, gray, never
 * competing with the amount.
 */
export function PriceToman({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value === null) return null;
  return (
    <span dir="auto" className={className}>
      {value.toLocaleString("fa-IR")}{" "}
      <span className="text-[0.5em] font-normal text-zinc-500 dark:text-zinc-400">
        تومان
      </span>
    </span>
  );
}
