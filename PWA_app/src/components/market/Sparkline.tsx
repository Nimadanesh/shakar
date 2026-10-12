"use client";

/**
 * Tiny 30-day daily-close sparkline for the market prices tab.
 * Deliberately neutral (foreground at 55%): the line shows the month's
 * shape while the ▲▼ badge next to it carries the day's direction —
 * coloring both would imply they always agree, which they don't.
 */
export function Sparkline({
  points,
  width = 76,
  height = 26,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  let d = "";
  if (points.length >= 2) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const pad = 3;
    const step = (width - pad * 2) / (points.length - 1);
    d = points
      .map((p, i) => {
        const x = pad + i * step;
        const y = pad + (1 - (p - min) / range) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      {d !== "" && (
        <path
          d={d}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.55}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
