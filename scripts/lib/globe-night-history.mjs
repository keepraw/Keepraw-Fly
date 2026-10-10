// Scalar response before the shared warm palette / solar mask / output transform.
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const b2 = (r) => 1.6 * Math.max(r - 0.012, 0) ** 0.85;
export const b34 = (r) => {
  const s = Math.max(r - 0.012, 0),
    m = s ** 1.25;
  return ((0.13 * m) / (0.24 + m)) * smooth(0, 0.075, s);
};
