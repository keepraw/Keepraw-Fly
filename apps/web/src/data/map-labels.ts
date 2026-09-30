import { WORLD_WIDTH } from "./map-geometry";
import type { MapCamera, ProjectedPoint } from "./map-camera";

interface LabelPoint { iata: string; point: ProjectedPoint; flightCount: number }
interface LabelPosition { x: number; y: number; anchor: "start" | "end" }

export function airportLabelPositions(points: LabelPoint[], camera: MapCamera, height: number, required: ReadonlySet<string>, pixelScale = 1) {
  const placed: { left: number; top: number; right: number; bottom: number }[] = [];
  const labels = new Map<string, LabelPosition>();
  const ordered = [...points].sort((a, b) => Number(required.has(b.iata)) - Number(required.has(a.iata))
    || b.flightCount - a.flightCount || a.iata.localeCompare(b.iata));
  const candidates: LabelPosition[] = [
    { x: 9, y: -8, anchor: "start" }, { x: -9, y: -8, anchor: "end" },
    { x: 9, y: 19, anchor: "start" }, { x: -9, y: 19, anchor: "end" },
  ];
  for (const point of ordered) {
    const x = (point.point.x - camera.centerX) * camera.zoom + WORLD_WIDTH / 2;
    const y = (point.point.y - camera.centerY) * camera.zoom + height / 2;
    if (x < 0 || x > WORLD_WIDTH || y < 0 || y > height) continue;
    const choices = candidates.map((position) => {
      const left = x + (position.x - (position.anchor === "end" ? 36 : 0)) * pixelScale;
      const box = { left, top: y + (position.y - 13) * pixelScale, right: left + 36 * pixelScale, bottom: y + (position.y + 3) * pixelScale };
      const overlaps = placed.filter((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top).length;
      return { position, box, overlaps };
    }).filter(({ box }) => box.left >= 3 && box.right <= WORLD_WIDTH - 3 && box.top >= 3 && box.bottom <= height - 3)
      .sort((a, b) => a.overlaps - b.overlaps);
    const best = choices[0];
    if (!best || (best.overlaps > 0 && !required.has(point.iata))) continue;
    placed.push(best.box);
    labels.set(point.iata, best.position);
  }
  return labels;
}
