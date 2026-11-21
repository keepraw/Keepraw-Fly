import type { ProjectedPoint } from "./geometry";

export function traceSegments(
  ctx: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo">,
  segments: readonly (readonly ProjectedPoint[])[],
  toCanvas: (point: ProjectedPoint) => { x: number; y: number },
): void {
  for (const segment of segments) {
    if (!segment.length) continue;
    const first = toCanvas(segment[0]!);
    ctx.moveTo(first.x, first.y);
    for (const point of segment.slice(1)) {
      const canvasPoint = toCanvas(point);
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  }
}
