import { describe, expect, it, vi } from "vitest";
import { traceSegments } from "./canvas-path";
import type { ProjectedPoint } from "./geometry";
import { segmentsToPath } from "./svg-path";

const segments: ProjectedPoint[][] = [
  [
    { x: 1.234, y: 2.345 },
    { x: 4.567, y: 5.678 },
  ],
  [
    { x: 10, y: 12 },
    { x: 15, y: 18 },
    { x: 20, y: 24 },
  ],
];

describe("map2d path adapters", () => {
  it("emits one SVG move per segment and one line per following point", () => {
    const path = segmentsToPath(segments);
    expect(path.match(/M /g)).toHaveLength(segments.length);
    expect(path.match(/ L /g)).toHaveLength(
      segments.reduce((count, segment) => count + segment.length - 1, 0),
    );
    expect(path).toContain("1.23 2.35");
  });

  it("traces matching Canvas move and line commands", () => {
    const ctx = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    };
    traceSegments(ctx, segments, (point) => ({
      x: point.x * 2,
      y: point.y * 3,
    }));
    expect(ctx.moveTo).toHaveBeenCalledTimes(segments.length);
    expect(ctx.lineTo).toHaveBeenCalledTimes(
      segments.reduce((count, segment) => count + segment.length - 1, 0),
    );
    expect(ctx.moveTo).toHaveBeenNthCalledWith(1, 2.468, 7.035);
  });
});
