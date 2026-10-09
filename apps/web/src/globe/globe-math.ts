import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";

export type Vec3 = readonly [number, number, number];
export const dot = (a: Vec3, b: Vec3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const scale = (a: Vec3, n: number): Vec3 => [
  a[0] * n,
  a[1] * n,
  a[2] * n,
];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (a: Vec3): Vec3 =>
  scale(a, 1 / (Math.hypot(...a) || 1));
const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/** Matches Three SphereGeometry's equirectangular UVs: -180 at the seam. */
export function spherePoint(
  point: Pick<RoutePoint, "latitude" | "longitude">,
): Vec3 {
  const lat = (point.latitude * Math.PI) / 180;
  const lon = (point.longitude * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ];
}

export function geographicPoint(v: Vec3) {
  const n = normalize(v);
  return {
    latitude: (Math.asin(clamp(n[1])) * 180) / Math.PI,
    longitude: (Math.atan2(-n[2], n[0]) * 180) / Math.PI,
  };
}

/** Deterministic great circle, including coincident and antipodal endpoints. */
export function interpolateSphere(a: Vec3, b: Vec3, t: number): Vec3 {
  const cosine = clamp(dot(a, b));
  if (cosine > 0.999999) return normalize(add(scale(a, 1 - t), scale(b, t)));
  if (cosine < -0.999999) {
    const basis: Vec3 = Math.abs(a[1]) < 0.8 ? [0, 1, 0] : [1, 0, 0];
    const tangent = normalize(cross(a, basis));
    if (t === 1) return b;
    return add(
      scale(a, Math.cos(Math.PI * t)),
      scale(tangent, Math.sin(Math.PI * t)),
    );
  }
  const angle = Math.acos(cosine);
  return add(
    scale(a, Math.sin((1 - t) * angle) / Math.sin(angle)),
    scale(b, Math.sin(t * angle) / Math.sin(angle)),
  );
}

export function routeArc(route: RouteSegment, steps = 96): Vec3[] {
  const a = spherePoint(route.origin),
    b = spherePoint(route.destination);
  const angle = Math.acos(clamp(dot(a, b)));
  // Saturation keeps intercontinental arcs below 3.5% of the sphere radius.
  const height = angle < 1e-6 ? 0 : 0.004 + 0.03 * (1 - Math.exp(-angle / 1.1));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return scale(
      interpolateSphere(a, b, t),
      1.002 + Math.pow(Math.sin(Math.PI * t), 1.2) * height,
    );
  });
}

export const routeKey = (route: RouteSegment) =>
  `${route.origin.iata}-${route.destination.iata}`;

/** One physical stroke per airport pair; directed records remain intact. */
export function physicalGlobeRoutes(routes: RouteSegment[]) {
  const pairs = new Map<string, RouteSegment[]>();
  for (const route of [...routes].sort(
    (a, b) =>
      routeKey(a).localeCompare(routeKey(b)) || a.flightCount - b.flightCount,
  )) {
    const key = [route.origin.iata, route.destination.iata].sort().join("-");
    const directions = pairs.get(key) ?? [];
    directions.push(route);
    pairs.set(key, directions);
  }
  return [...pairs.values()].sort(
    (a, b) =>
      a.reduce((sum, r) => sum + r.flightCount, 0) -
      b.reduce((sum, r) => sum + r.flightCount, 0),
  );
}

export function globeAirports(routes: RouteSegment[]) {
  const points = new Map<string, RoutePoint & { flightCount: number }>();
  for (const route of routes)
    for (const point of [route.origin, route.destination]) {
      const current = points.get(point.iata);
      points.set(point.iata, {
        ...point,
        flightCount: (current?.flightCount ?? 0) + route.flightCount,
      });
    }
  return [...points.values()].sort(
    (a, b) => b.flightCount - a.flightCount || a.iata.localeCompare(b.iata),
  );
}

export interface GlobeView {
  direction: Vec3;
  distance: number;
  offset?: { x: number; y: number };
}

export interface GlobeViewport {
  width: number;
  height: number;
}
const defaultViewport = { width: 1008, height: 610 };
const tangent = Math.tan((17 * Math.PI) / 180);

/** Normalized screen coordinates, including perspective and fractional view offset. */
export function projectGlobePoint(
  point: Vec3,
  view: GlobeView,
  viewport: GlobeViewport = defaultViewport,
) {
  const forward = scale(view.direction, -1);
  const right = normalize(
    cross(forward, Math.abs(view.direction[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0]),
  );
  const up = cross(right, forward);
  const delta = add(point, scale(view.direction, -view.distance));
  const depth = dot(delta, forward);
  return {
    x:
      0.5 +
      dot(delta, right) /
        ((2 * tangent * depth * viewport.width) / viewport.height) -
      (view.offset?.x ?? 0),
    y: 0.5 - dot(delta, up) / (2 * tangent * depth) - (view.offset?.y ?? 0),
    visible: visibleFrom(point, scale(view.direction, view.distance)),
  };
}

/** Search on the sphere, then refine. Scoring favors frequent airports and
 * whole routes, penalizes limb endpoints, and never averages raw longitudes. */
export function representativeGlobeDirection(input: RouteSegment[]): Vec3 {
  const routes = [...input].sort((a, b) =>
    routeKey(a).localeCompare(routeKey(b)),
  );
  if (!routes.length) return spherePoint({ latitude: 30, longitude: 110 });
  const airports = globeAirports(routes);
  const samples = routes.map((route) => ({
    weight: Math.pow(route.flightCount, 0.85),
    points: [0, 0.25, 0.5, 0.75, 1].map((t) =>
      interpolateSphere(
        spherePoint(route.origin),
        spherePoint(route.destination),
        t,
      ),
    ),
  }));
  const score = (direction: Vec3) => {
    const airportScore = airports.reduce(
      (sum, p) =>
        sum +
        p.flightCount ** 0.9 *
          Math.max(0, dot(direction, spherePoint(p)) - 0.35) ** 2.5,
      0,
    );
    const routeScore = samples.reduce((sum, r) => {
      const visibility = r.points.map((p) => dot(direction, p));
      const average =
        visibility.reduce((s, n) => s + Math.max(0, n - 0.12), 0) / 5;
      return (
        sum +
        r.weight *
          (average * 0.25 +
            Math.max(0, Math.min(...visibility) - 0.5) ** 1.8 * 2.5)
      );
    }, 0);
    // Whole-route coverage helps within the winning region, but must not make
    // sparse intercontinental routes overpower a user's frequently visited hub.
    return airportScore + routeScore * 0.8;
  };
  const candidates: Vec3[] = airports.map(spherePoint);
  candidates.push(...samples.map((r) => r.points[2]!));
  for (let i = 0; i < 192; i++) {
    const y = 1 - (2 * (i + 0.5)) / 192,
      phi = i * Math.PI * (3 - Math.sqrt(5));
    candidates.push([
      Math.sqrt(1 - y * y) * Math.cos(phi),
      y,
      Math.sqrt(1 - y * y) * Math.sin(phi),
    ]);
  }
  let best = candidates[0]!,
    bestScore = -Infinity;
  for (const c of candidates) {
    const s = score(c);
    if (s > bestScore + 1e-9) {
      best = c;
      bestScore = s;
    }
  }
  for (const step of [0.12, 0.04, 0.012])
    for (let iteration = 0; iteration < 4; iteration++) {
      for (const axis of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ] as Vec3[])
        for (const sign of [-1, 1]) {
          const c = normalize(add(best, scale(axis, step * sign))),
            s = score(c);
          if (s > bestScore + 1e-9) {
            best = c;
            bestScore = s;
          }
        }
    }
  return best;
}

/** Stage two: choose a near-surface photograph, keeping weighted activity in a
 * safe screen region and the horizon near the upper fifth of the viewport. */
export function composeGlobeView(
  routes: RouteSegment[],
  representative: Vec3,
  viewport: GlobeViewport = defaultViewport,
): GlobeView {
  const airports = globeAirports(routes).map((p) => ({
    point: scale(spherePoint(p), 1.005),
    weight:
      p.flightCount ** 0.85 *
      Math.max(
        0.025,
        Math.max(0, dot(representative, spherePoint(p)) - 0.25) ** 2,
      ),
  }));
  const geo = geographicPoint(representative);
  let best: GlobeView = {
    direction: representative,
    distance: 2.65,
    offset: { x: 0, y: 0 },
  };
  let bestScore = -Infinity;
  const total = airports.reduce((s, p) => s + p.weight, 0) || 1;
  for (const latitudeShift of [-12, -18, -24, -30])
    for (const longitudeShift of [-7, 0, 7])
      for (const distance of [
        1.68, 1.8, 1.94, 2.1, 2.35, 2.65, 3.1, 3.8, 4.4,
      ]) {
        const direction = spherePoint({
          latitude: Math.max(-78, Math.min(78, geo.latitude + latitudeShift)),
          longitude: geo.longitude + longitudeShift,
        });
        const view: GlobeView = { direction, distance };
        const projected = airports.map((p) => ({
          ...p,
          ...projectGlobePoint(p.point, view, viewport),
        }));
        const visible = projected.filter((p) => p.visible);
        const weight = visible.reduce((s, p) => s + p.weight, 0) || 1;
        const x = visible.reduce((s, p) => s + p.x * p.weight, 0) / weight;
        const y = visible.reduce((s, p) => s + p.y * p.weight, 0) / weight;
        view.offset = {
          x: Math.max(-0.12, Math.min(0.12, x - 0.5)),
          y: Math.max(-0.9, Math.min(-0.1, y - 0.6)),
        };
        let score = 0;
        for (const p of projected) {
          const px = p.x - view.offset.x,
            py = p.y - view.offset.y;
          const inside = px > 0.06 && px < 0.92 && py > 0.16 && py < 0.9;
          const comfort = Math.exp(
            -((px - 0.5) ** 2 / 0.2 + (py - 0.6) ** 2 / 0.22),
          );
          score += p.weight * (p.visible && inside ? 0.55 + comfort : -0.35);
        }
        // Actual route projection contributes separately from airport popularity.
        for (const route of routes) {
          const a = spherePoint(route.origin),
            b = spherePoint(route.destination);
          for (const t of [0.25, 0.5, 0.75]) {
            const p = projectGlobePoint(
              scale(interpolateSphere(a, b, t), 1.004),
              view,
              viewport,
            );
            if (
              p.visible &&
              p.x > 0.08 &&
              p.x < 0.92 &&
              p.y > 0.16 &&
              p.y < 0.9
            )
              score +=
                route.flightCount ** 0.7 *
                0.12 *
                Math.max(
                  0,
                  dot(representative, interpolateSphere(a, b, t)) - 0.3,
                );
          }
        }
        const horizon =
          0.5 -
          view.offset.y -
          1 / (2 * tangent * Math.sqrt(distance * distance - 1));
        score /= total;
        score -= Math.abs(horizon - 0.06) * 0.65;
        score -= Math.max(0, distance - 2.1) * 0.35;
        if (score > bestScore + 1e-9) {
          best = view;
          bestScore = score;
        }
      }
  return best;
}

export function defaultGlobeView(
  input: RouteSegment[],
  viewport: GlobeViewport = defaultViewport,
): GlobeView {
  if (!input.length)
    return {
      direction: spherePoint({ latitude: 20, longitude: 110 }),
      distance: 2.35,
      offset: { x: 0, y: -0.25 },
    };
  return composeGlobeView(input, representativeGlobeDirection(input), viewport);
}

export function selectedRouteView(
  route: RouteSegment,
  viewport: GlobeViewport = defaultViewport,
): GlobeView {
  const a = spherePoint(route.origin),
    b = spherePoint(route.destination);
  const angle = Math.acos(clamp(dot(a, b)));
  const direction = interpolateSphere(a, b, 0.5);
  const forward = scale(direction, -1),
    right = normalize(
      cross(forward, Math.abs(direction[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0]),
    ),
    up = cross(right, forward);
  const fit = Math.max(
    ...[a, b].map(
      (p) =>
        dot(p, direction) +
        Math.max(
          Math.abs(dot(p, right)) /
            ((tangent * 0.8 * viewport.width) / viewport.height),
          Math.abs(dot(p, up)) / (tangent * 0.74),
        ),
    ),
  );
  return {
    direction,
    distance: Math.min(
      6.2,
      Math.max(2.05, fit, 1 / Math.max(0.01, Math.cos(angle / 2)) + 0.05),
    ),
    offset: { x: 0, y: 0 },
  };
}

/** Segment/sphere occlusion also works for elevated arcs near the horizon. */
export function visibleFrom(point: Vec3, camera: Vec3, radius = 1): boolean {
  const delta = add(point, scale(camera, -1));
  const length = Math.hypot(...delta),
    d = scale(delta, 1 / length);
  const b = dot(camera, d),
    c = dot(camera, camera) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return true;
  const near = -b - Math.sqrt(discriminant);
  return near < 0 || near >= length - 0.0001;
}
