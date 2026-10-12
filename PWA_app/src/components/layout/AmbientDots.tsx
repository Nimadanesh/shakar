"use client";

/**
 * AmbientDots — a whisper-quiet animated background: tiny dots of
 * different sizes drifting at different speeds, no pattern.
 *
 * PERFORMANCE (non-negotiable — navid 2026-10-12: speed outranks beauty):
 * - CSS keyframes animate ONLY `transform` (compositor thread; zero
 *   layout, zero paint per frame).
 * - 22 dots, each a 2–5px div. No canvas, no JS timers, no scroll
 *   listeners.
 * - Deterministic layout (seeded PRNG at module level) → identical on
 *   server and client, no hydration mismatch, no extra render.
 * - `prefers-reduced-motion: reduce` → the whole layer is display:none.
 * - `pointer-events: none`, painted behind content (DOM order + relative
 *   content wrapper).
 */
interface DotSpec {
  left: number; // %
  top: number; // %
  size: number; // px
  duration: number; // s
  delay: number; // s (negative = desync)
  dx: number; // px drift
  dy: number; // px drift
  opacity: number;
}

// Seeded PRNG — stable across SSR and client.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDots(): DotSpec[] {
  const rand = mulberry32(0x5eed9a);
  const dots: DotSpec[] = [];
  for (let i = 0; i < 22; i++) {
    dots.push({
      left: rand() * 100,
      top: rand() * 100,
      size: 2 + rand() * 3, // 2–5px
      duration: 22 + rand() * 26, // 22–48s: slow, calm
      delay: -(rand() * 48), // spread across the cycle
      dx: (rand() - 0.5) * 90, // ±45px drift
      dy: (rand() - 0.5) * 70, // ±35px drift
      opacity: 0.35 + rand() * 0.65, // multiplied by the color's alpha
    });
  }
  return dots;
}

const DOTS = buildDots();

export function AmbientDots() {
  return (
    <div
      aria-hidden="true"
      className="ambient-dots pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="ambient-dot absolute rounded-full bg-black/[0.05] dark:bg-white/[0.07]"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            ["--dx" as string]: `${d.dx}px`,
            ["--dy" as string]: `${d.dy}px`,
            animation: `ambient-drift ${d.duration}s ease-in-out ${d.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
