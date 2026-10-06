import { describe, expect, it } from "vitest";
import { computeOrbitTargets, type OrbitLayout } from "./orbitChoreography";

const layout: OrbitLayout = {
  slotCenters: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 40, y: 0 },
  ],
  hub: { x: 100, y: 100 },
  radius: 50,
};

describe("computeOrbitTargets", () => {
  it("places the first digit at the top of the orbit", () => {
    const [top] = computeOrbitTargets(layout);
    expect(top.x).toBeCloseTo(100, 5);
    expect(top.y).toBeCloseTo(50, 5);
  });

  it("spaces five slots at 72° clockwise from the top", () => {
    const targets = computeOrbitTargets(layout);
    const expectedAngles = [-90, -18, 54, 126, 198];
    targets.forEach((t, i) => {
      const rad = (expectedAngles[i] * Math.PI) / 180;
      expect(t.x).toBeCloseTo(100 + 50 * Math.cos(rad), 5);
      expect(t.y).toBeCloseTo(100 + 50 * Math.sin(rad), 5);
    });
  });

  it("keeps every target exactly on the orbit radius", () => {
    for (const t of computeOrbitTargets(layout)) {
      const dist = Math.hypot(t.x - 100, t.y - 100);
      expect(dist).toBeCloseTo(50, 5);
    }
  });

  it("adapts to any slot count (four slots → 90° spacing)", () => {
    const four: OrbitLayout = {
      ...layout,
      slotCenters: layout.slotCenters.slice(0, 4),
    };
    const targets = computeOrbitTargets(four);
    expect(targets).toHaveLength(4);
    // right, bottom, left for slots 2–4
    expect(targets[1].x).toBeCloseTo(150, 5);
    expect(targets[1].y).toBeCloseTo(100, 5);
    expect(targets[2].x).toBeCloseTo(100, 5);
    expect(targets[2].y).toBeCloseTo(150, 5);
    expect(targets[3].x).toBeCloseTo(50, 5);
    expect(targets[3].y).toBeCloseTo(100, 5);
  });
});
