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
      duration: 8 + rand() * 10, // 8–18s: visibly alive, still calm
      delay: -(rand() * 18), // spread across the cycle
      dx: (rand() - 0.5) * 140, // ±70px drift
      dy: (rand() - 0.5) * 110, // ±55px drift
      opacity: 0.35 + rand() * 0.65, // multiplied by the color's alpha
    });
  }
  return dots;
}

const DOTS = buildDots();

interface MeteorSpec {
  top: string;
  left: string;
  angle: number; // deg — the streak diagonal
  duration: number; // s — full cycle (mostly invisible, waiting)
  delay: number; // s (negative = desync)
  length: number; // px — tail length
}

// Two meteors, rare and surprising: each is visible for ~1.5s per cycle,
// the rest of the time it's gone waiting for the next fall.
const METEORS: MeteorSpec[] = [
  { top: "10%", left: "68%", angle: -32, duration: 16, delay: -4, length: 110 },
  { top: "26%", left: "82%", angle: -27, duration: 23, delay: -13, length: 88 },
];

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
      {METEORS.map((m, i) => (
        <span
          key={`meteor-${i}`}
          className="meteor absolute"
          style={{
            top: m.top,
            left: m.left,
            ["--meteor-angle" as string]: `${m.angle}deg`,
            animation: `meteor-shoot ${m.duration}s linear ${m.delay}s infinite`,
          }}
        >
          <span
            className="meteor-tail block h-[3px] rounded-full"
            style={{ width: m.length }}
          />
          <span className="meteor-head absolute -left-[2px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full" />
        </span>
      ))}
    </div>
  );
}
