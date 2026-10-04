import type { MatchReason } from "@/types/search";

export function MatchReasons({ reasons }: { reasons: MatchReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul aria-label="دلایل نمایش" className="flex flex-col gap-1">
      {reasons.map((reason, index) => (
        <li
          key={`${reason.text}-${index}`}
          className="flex items-center gap-1.5 text-[13px] leading-5"
        >
          <span
            aria-hidden="true"
            className={reason.tone === "signal" ? "font-semibold text-signal" : "font-semibold text-warning"}
          >
            {reason.tone === "signal" ? "✓" : "؟"}
          </span>
          <span className={reason.tone === "signal" ? "text-foreground" : "text-muted-foreground"}>
            {reason.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
