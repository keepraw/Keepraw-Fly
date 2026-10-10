import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { nightResponse } from "./globe-night-response";

const audit = JSON.parse(
  readFileSync(
    new URL(
      "../../../../docs/visual-review/task-1b-5/texture-audit.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function previous(r: number) {
  const s = Math.max(r - 0.012, 0),
    m = s ** 1.25;
  const t = Math.min(1, s / 0.075);
  return ((0.13 * m) / (0.24 + m)) * t * t * (3 - 2 * t);
}
const mean = (
  hist: number[],
  fn: (r: number) => number,
  start = 0,
  end = 256,
) => {
  let sum = 0,
    count = 0;
  for (let i = start; i < end; i++) {
    sum += hist[i]! * fn(i / 255);
    count += hist[i]!;
  }
  return sum / count;
};
describe("measured Black Marble response", () => {
  it("is finite and smooth, preserves positive tonal ordering, and bounds the old peak", () => {
    let last = 0;
    for (let i = 0; i <= 10000; i++) {
      const output = nightResponse(i / 10000);
      expect(Number.isFinite(output)).toBe(true);
      expect(output).toBeGreaterThanOrEqual(last);
      if (i > 121) expect(output).toBeGreaterThan(last);
      expect(output).toBeLessThanOrEqual(previous(1) * 1.001);
      // Numerical continuity: no jumps on a dense input sweep.
      expect(output - last).toBeLessThan(0.001);
      last = output;
    }
    for (let byte = 0; byte <= 3; byte++)
      expect(nightResponse(byte / 255)).toBe(0);
  });
  for (const resolution of ["2048", "4096"]) {
    it(`restores real ${resolution} urban peripheries without raising peaks or lighting dark backgrounds`, () => {
      const texture = audit.textures.find(
        (t: { name: string }) => t.name === resolution,
      );
      const bytes = readFileSync(
        new URL(`assets/night-${resolution}.webp`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        texture.sha256,
      );
      for (const region of texture.regions) {
        const hist: number[] = region.histograms.periphery;
        if (["tibet", "sahara", "ocean"].includes(region.id)) {
          // Measured ≥99.7% background remains exactly zero at both resolutions.
          const zero =
            hist.slice(0, 4).reduce((a, b) => a + b, 0) /
            hist.reduce((a, b) => a + b, 0);
          expect(zero).toBeGreaterThan(0.997);
          expect(region.statistics.all.input.q90).toBe(0);
          expect(mean(hist, nightResponse)).toBeLessThan(0.0002);
        } else {
          // Input 4..25 comes from actual low urban pixels in every audit region.
          // A twofold recovery here leaves high-input peaks at the B4 bound.
          expect(mean(hist, nightResponse, 4, 26)).toBeGreaterThan(
            mean(hist, previous, 4, 26) * 2,
          );
          expect(mean(hist, nightResponse)).toBeGreaterThan(
            mean(hist, previous),
          );
          const { litQ10, litQ50, litQ90 } = region.statistics.periphery.input;
          expect(nightResponse(litQ50)).toBeGreaterThan(nightResponse(litQ10));
          expect(nightResponse(litQ90)).toBeGreaterThan(nightResponse(litQ50));
          const core: number[] = region.histograms.core;
          expect(mean(core, nightResponse)).toBeGreaterThan(
            mean(hist, nightResponse),
          );
          expect(mean(core, nightResponse)).toBeLessThan(0.105);
        }
      }
    });
  }
});
