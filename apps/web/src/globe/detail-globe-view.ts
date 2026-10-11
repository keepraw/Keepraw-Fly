import type { RouteSegment } from "@keepraw-fly/core";
import {
  cross,
  dot,
  interpolateSphere,
  normalize,
  routeArc,
  scale,
  spherePoint,
  visibleFrom,
  type GlobeView,
  type GlobeViewport,
} from "./globe-math";

/** Single-flight framing, independent of Passport's photographic composition. */
export function detailGlobeView(
  route: RouteSegment,
  viewport: GlobeViewport,
): GlobeView {
  let direction = normalize(
    interpolateSphere(
      spherePoint(route.origin),
      spherePoint(route.destination),
      0.5,
    ),
  );
  // Keep the initial view inside the existing OrbitControls polar limits.
  if (Math.abs(direction[1]) > Math.cos(0.0011)) {
    const horizontal = normalize([direction[0] || 1e-9, 0, direction[2]]);
    direction = [
      horizontal[0] * Math.sin(0.0011),
      Math.sign(direction[1]) * Math.cos(0.0011),
      horizontal[2] * Math.sin(0.0011),
    ];
  }
  const points = routeArc(route);
  const right = normalize(cross(scale(direction, -1), [0, 1, 0]));
  const up = cross(right, scale(direction, -1));
  const aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
  // At antipodes the elevated endpoints lie on opposite limbs. Pull back
  // until the entire actual arc clears the sphere, then narrow the lens to
  // retain a useful globe size instead of an extreme tiny-globe zoom-out.
  let low = 2.45,
    high = 40;
  for (let i = 0; i < 40; i++) {
    const distance = (low + high) / 2;
    if (points.every((p) => visibleFrom(p, scale(direction, distance))))
      high = distance;
    else low = distance;
  }
  const distance = high + 0.04;
  const fit = Math.max(
    ...points.map((p) => {
      const depth = distance - dot(p, direction);
      return Math.max(
        Math.abs(dot(p, right)) / (depth * aspect * 0.68),
        Math.abs(dot(p, up)) / (depth * 0.68),
      );
    }),
  );
  const lens = Math.max(
    fit * 1.01,
    // A sphere's perspective silhouette has radius 1/sqrt(distance² - 1).
    // Keep ordinary routes at 88% of the short side, leaving visible space;
    // the actual route fit still takes priority for long/polar/antipodal arcs.
    1 / (Math.sqrt(distance * distance - 1) * 0.88 * Math.min(1, aspect)),
  );
  return {
    direction,
    distance,
    fov: (2 * Math.atan(lens) * 180) / Math.PI,
    offset: { x: 0, y: 0 },
  };
}
