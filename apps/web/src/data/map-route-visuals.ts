/** Keep single-flight routes readable; emphasize repeated routes without unbounded strokes. */
export function routeVisuals(count: number) {
  const level = Math.min(Math.log2(Math.max(count, 1)), 4);
  return { width: 2.2 + level * 0.55, strength: 82 + level * 4.5 };
}
