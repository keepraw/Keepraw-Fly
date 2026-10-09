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
  const height = 0.009 + Math.pow(angle / Math.PI, 0.8) * 0.115;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return scale(
      interpolateSphere(a, b, t),
      1.002 + Math.sin(Math.PI * t) * height,
    );
  });
}

export const routeKey = (route: RouteSegment) =>
  `${route.origin.iata}-${route.destination.iata}`;

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
}

/** Search on the sphere, then refine. Scoring favors frequent airports and
 * whole routes, penalizes limb endpoints, and never averages raw longitudes. */
export function defaultGlobeView(input: RouteSegment[]): GlobeView {
  const routes = [...input].sort((a, b) =>
    routeKey(a).localeCompare(routeKey(b)),
  );
  if (!routes.length)
    return {
      direction: spherePoint({ latitude: 30, longitude: 110 }),
      distance: 2.65,
    };
  const airports = globeAirports(routes);
  const samples = routes.map((route) => ({
    weight: Math.sqrt(route.flightCount),
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
        p.flightCount ** 1.25 *
          Math.max(0, dot(direction, spherePoint(p)) - 0.22) ** 3,
      0,
    );
    const routeScore = samples.reduce((sum, r) => {
      const visibility = r.points.map((p) => dot(direction, p));
      const average =
        visibility.reduce((s, n) => s + Math.max(0, n - 0.12), 0) / 5;
      return (
        sum +
        r.weight *
          (average * 1.4 + Math.max(0, Math.min(...visibility) - 0.22) * 1.8)
      );
    }, 0);
    // Whole-route coverage helps within the winning region, but must not make
    // sparse intercontinental routes overpower a user's frequently visited hub.
    return airportScore + routeScore * 0.35;
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
  // A small southward look offsets dense northern activity toward the horizon.
  const geo = geographicPoint(best);
  return {
    direction: spherePoint({
      ...geo,
      latitude: Math.max(-78, Math.min(78, geo.latitude - 9)),
    }),
    distance: 2.65,
  };
}

export function selectedRouteView(route: RouteSegment): GlobeView {
  const a = spherePoint(route.origin),
    b = spherePoint(route.destination);
  const angle = Math.acos(clamp(dot(a, b)));
  return {
    direction: interpolateSphere(a, b, 0.5),
    distance: Math.max(2.65, Math.min(5.8, 1.2 + 3.7 * Math.sin(angle / 2))),
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
