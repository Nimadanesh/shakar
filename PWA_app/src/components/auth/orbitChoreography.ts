/**
 * orbitChoreography.ts
 *
 * Framework-agnostic OTP "orbit" micro-interaction, built on the
 * Web Animations API. The SAME digit tiles travel from their input row
 * onto a circular orbit (FLIP-style measured transforms — no teleporting,
 * no duplicated tiles), spin 450° around a fixed hub, take the success
 * verdict, collapse into the hub and hand off to the success UI.
 *
 * React (OtpOrbit.tsx) owns rendering + state; this module owns motion.
 * Zero imports — it compiles to a single dependency-free JS file so the
 * QA fixture can exercise the exact same code.
 */

export const MOTION = {
  /** pause after the last digit, before the ritual starts */
  completionPause: 320,
  /** orbital guide reveal */
  orbitReveal: 320,
  /** per-tile curl onto the orbit */
  curl: 560,
  /** stagger between tiles while curling (the row "bends") */
  curlStagger: 70,
  /** 450° orbital spin */
  spin: 1400,
  /** verdict color transition */
  verdict: 240,
  /** collapse into the hub */
  collapse: 520,
  /** error shake */
  shake: 460,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface OrbitLayout {
  slotCenters: Point[];
  hub: Point;
  radius: number;
}

export interface OrbitElements {
  stage: HTMLElement;
  row: HTMLElement;
  orbit: HTMLElement;
  ring: HTMLElement;
  hub: HTMLElement;
  slots: HTMLElement[];
  digits: HTMLElement[];
}

/**
 * Pure geometry: slot i lands at angle -90° + i·(360°/n), i.e. the first
 * digit at the top, the rest clockwise around the hub.
 */
export function computeOrbitTargets(layout: OrbitLayout): Point[] {
  const n = layout.slotCenters.length;
  return layout.slotCenters.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: layout.hub.x + layout.radius * Math.cos(angle),
      y: layout.hub.y + layout.radius * Math.sin(angle),
    };
  });
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** An animation's `finished` promise rejects when cancelled — treat that as settled. */
function settled(animation: Animation): Promise<unknown> {
  return animation.finished.catch(() => undefined);
}

function centerOf(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function px(n: number): string {
  return `${n}px`;
}

/** Per-slot bookkeeping across phases: layout position + current offset. */
interface SlotState {
  lx: number;
  ly: number;
  dx: number;
  dy: number;
}

const slotState = new WeakMap<HTMLElement, SlotState>();

export function measureLayout(els: OrbitElements): OrbitLayout {
  const orbitRect = els.orbit.getBoundingClientRect();
  return {
    slotCenters: els.slots.map(centerOf),
    hub: centerOf(els.hub),
    radius: orbitRect.width / 2 - 30,
  };
}

/**
 * Phases 1–2: reveal the orbital guide, then curl the row onto the orbit.
 * Reparents the slots into the orbit box (FLIP) so the later spin can
 * rotate them rigidly around the hub with one transform.
 */
export async function playVerification(els: OrbitElements): Promise<void> {
  const orbitRect = els.orbit.getBoundingClientRect();
  const layout = measureLayout(els);
  const targets = computeOrbitTargets(layout);
  const n = els.slots.length;

  // Reparent: pin each slot at its current visual spot inside the orbit box.
  // The orbit box has no border/padding, so viewport coords map 1:1.
  els.slots.forEach((slot) => {
    const r = slot.getBoundingClientRect();
    const lx = r.left - orbitRect.left;
    const ly = r.top - orbitRect.top;
    slotState.set(slot, { lx, ly, dx: 0, dy: 0 });
    slot.style.position = "absolute";
    slot.style.left = px(lx);
    slot.style.top = px(ly);
    slot.style.margin = "0";
    els.orbit.appendChild(slot);
  });

  // Reveal the orbital guide (CSS transition).
  els.orbit.classList.add("is-live");
  await wait(MOTION.orbitReveal);

  // Curl each tile onto its orbit station, staggered so the row bends.
  const slotW = els.slots[0].offsetWidth;
  const slotH = els.slots[0].offsetHeight;
  const animations: Animation[] = [];
  els.slots.forEach((slot, i) => {
    const st = slotState.get(slot);
    if (!st) return;
    const wantLeft = targets[i].x - orbitRect.left - slotW / 2;
    const wantTop = targets[i].y - orbitRect.top - slotH / 2;
    const dx = wantLeft - st.lx;
    const dy = wantTop - st.ly;
    slotState.set(slot, { ...st, dx, dy });
    animations.push(
      slot.animate(
        [{ transform: "translate(0px, 0px)" }, { transform: `translate(${px(dx)}, ${px(dy)})` }],
        {
          duration: MOTION.curl,
          delay: i * MOTION.curlStagger,
          easing: "cubic-bezier(0.45, 0, 0.2, 1)",
          fill: "forwards",
        }
      )
    );
  });
  await Promise.all(animations.map(settled));
}

/**
 * Phase 3: rotate the whole orbit 450° (one full turn + 90°) around the
 * fixed hub. Tiles are deliberately NOT counter-rotated — they tumble in
 * world space as part of the rigid system.
 */
export function startSpin(els: OrbitElements): Animation {
  return els.orbit.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(450deg)" }],
    {
      duration: MOTION.spin,
      easing: "cubic-bezier(0.55, 0.02, 0.2, 1)",
      fill: "forwards",
    }
  );
}

export async function playSpin(els: OrbitElements): Promise<void> {
  await settled(startSpin(els));
}

/** Phase 4: the success color locks in (CSS transition on the stage). */
export function applyVerdict(els: OrbitElements): void {
  els.stage.classList.add("is-verified");
}

/**
 * Phase 5: compress the orbital system into the hub — radius → 0, tiles
 * shrink, digits fade, the ring contracts. Nothing fades out in place;
 * every tile visibly travels to the center.
 */
export async function playCollapse(els: OrbitElements): Promise<void> {
  // The orbit may still carry the finished 450° spin (≡ 90°); a square's
  // box is unchanged by quarter turns, so offsetWidth stays truthful.
  const orbitW = els.orbit.offsetWidth;
  const slotW = els.slots[0].offsetWidth;
  const slotH = els.slots[0].offsetHeight;
  const hubLeft = orbitW / 2 - slotW / 2;
  const hubTop = orbitW / 2 - slotH / 2;

  const animations: Animation[] = [];
  els.slots.forEach((slot, i) => {
    const st = slotState.get(slot);
    if (!st) return;
    const dx = hubLeft - st.lx;
    const dy = hubTop - st.ly;
    animations.push(
      slot.animate(
        [
          { transform: `translate(${px(st.dx)}, ${px(st.dy)}) scale(1)` },
          { transform: `translate(${px(dx)}, ${px(dy)}) scale(0.55)` },
        ],
        {
          duration: MOTION.collapse,
          delay: i * 35,
          easing: "cubic-bezier(0.5, 0, 0.15, 1)",
          fill: "forwards",
        }
      )
    );
    const digit = els.digits[i];
    if (digit) {
      settled(
        digit.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 320,
          delay: i * 35,
          easing: "ease-out",
          fill: "forwards",
        })
      );
    }
  });
  // The ring contracts and fades with the system.
  settled(
    els.ring.animate(
      [
        { opacity: 0.55, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.55)" },
      ],
      { duration: MOTION.collapse, easing: "ease-in", fill: "forwards" }
    )
  );
  await Promise.all(animations.map(settled));
  // Park the orbit; the caller swaps in the success UI.
  els.orbit.style.visibility = "hidden";
}

/** Reduced-motion path: skip the ritual, take the verdict directly. */
export async function playReducedVerification(els: OrbitElements): Promise<void> {
  await wait(MOTION.completionPause);
  els.stage.classList.add("is-verified");
  await wait(MOTION.verdict);
  els.orbit.style.visibility = "hidden";
  els.row.style.visibility = "hidden";
}

/** Restore the input row after a failed verification so the user can retry. */
export function restoreSlots(els: OrbitElements): void {
  els.orbit.getAnimations().forEach((a) => a.cancel());
  els.ring.getAnimations().forEach((a) => a.cancel());
  els.slots.forEach((slot, i) => {
    slot.getAnimations().forEach((a) => a.cancel());
    slot.style.position = "";
    slot.style.left = "";
    slot.style.top = "";
    slot.style.margin = "";
    slotState.delete(slot);
    els.row.appendChild(slot);
    const digit = els.digits[i];
    if (digit) {
      digit.getAnimations().forEach((a) => a.cancel());
      (digit as HTMLElement).style.opacity = "";
    }
  });
  els.orbit.classList.remove("is-live");
  els.orbit.style.visibility = "";
  els.stage.classList.remove("is-verified", "has-error");
  els.row.style.visibility = "";
}

/** Error state: restrained horizontal shake + red verdict. */
export async function playShake(els: OrbitElements): Promise<void> {
  els.stage.classList.add("has-error");
  await settled(
    els.row.animate(
      [
        { transform: "translateX(0px)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0px)" },
      ],
      { duration: MOTION.shake, easing: "cubic-bezier(0.3, 0, 0.3, 1)" }
    )
  );
}

/**
 * Phase 7: a restrained technical burst around the success core —
 * small dots radiating outward, not fireworks.
 */
export function burstParticles(container: HTMLElement, count = 16): void {
  if (prefersReducedMotion()) return;
  const cx = container.offsetWidth / 2;
  const cy = container.offsetHeight / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "otp-particle" + (i % 4 === 3 ? " is-ice" : "");
    p.style.left = px(cx);
    p.style.top = px(cy);
    container.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 52;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = 2 + Math.random() * 3;
    p.style.width = px(size);
    p.style.height = px(size);
    const anim = p.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 0.85 },
        { transform: `translate(${px(dx)}, ${px(dy)}) scale(0.3)`, opacity: 0 },
      ],
      {
        duration: 650 + Math.random() * 450,
        easing: "cubic-bezier(0.2, 0.6, 0.3, 1)",
        fill: "forwards",
      }
    );
    anim.onfinish = () => p.remove();
  }
}
