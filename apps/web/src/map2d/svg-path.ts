import type { ProjectedPoint } from "./geometry";

export function segmentsToPath(
  segments: readonly (readonly ProjectedPoint[])[],
  precision = 2,
): string {
  const digits = Math.max(0, Math.floor(precision));
  const format = (value: number) => Number(value.toFixed(digits)).toString();
  return segments
    .filter((segment) => segment.length)
    .map((segment) => {
      const [first, ...rest] = segment;
      return `M ${format(first!.x)} ${format(first!.y)}${rest
        .map((point) => ` L ${format(point.x)} ${format(point.y)}`)
        .join("")}`;
    })
    .join(" ");
}
