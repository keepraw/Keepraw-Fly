import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
import {
  projectPoint,
  sampleGreatCircle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GeographicPoint,
} from "./map-geometry";

export interface MapCamera {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export const WORLD_CAMERA: MapCamera = {
  centerX: WORLD_WIDTH / 2,
  centerY: WORLD_HEIGHT / 2,
  zoom: 1,
};

export function passportMapCamera(
  routes: RouteSegment[],
  airports: GeographicPoint[],
): MapCamera {
  const points = [
    ...airports.map(projectPoint),
    ...routes.flatMap((route) => sampleGreatCircle(route.origin, route.destination, 48)),
  ];
  return fitProjectedPoints(points, { maxZoom: 2.5, padding: 0.14 });
}

export function flightRouteCamera(origin: RoutePoint, destination: RoutePoint): MapCamera {
  return fitProjectedPoints(sampleGreatCircle(origin, destination, 72), {
    maxZoom: 7.5,
    padding: 0.18,
  });
}

export function unwrappedGreatCirclePath(origin: RoutePoint, destination: RoutePoint, steps = 72): string {
  const points = unwrapProjectedPoints(sampleGreatCircle(origin, destination, steps));
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)},${round(point.y)}`).join("");
}

export function fitProjectedPoints(
  points: ProjectedPoint[],
  options: { maxZoom: number; padding: number },
): MapCamera {
  if (points.length === 0) return WORLD_CAMERA;

  const unwrapped = unwrapProjectedPoints(points);
  const xs = unwrapped.map((point) => point.x);
  const ys = unwrapped.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const availableWidth = WORLD_WIDTH * (1 - options.padding * 2);
  const availableHeight = WORLD_HEIGHT * (1 - options.padding * 2);
  const zoom = Math.min(options.maxZoom, availableWidth / spanX, availableHeight / spanY);

  if (zoom <= 1.04) return WORLD_CAMERA;

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    zoom,
  };
}

export function unwrapProjectedPoints(points: ProjectedPoint[]): ProjectedPoint[] {
  if (points.length < 2) return points;

  const xs = points
    .map((point) => normalizeX(point.x))
    .sort((left, right) => left - right);
  let largestGap = -1;
  let cut = 0;

  for (let index = 0; index < xs.length; index += 1) {
    const current = xs[index]!;
    const next = index === xs.length - 1 ? xs[0]! + WORLD_WIDTH : xs[index + 1]!;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      cut = normalizeX(next);
    }
  }

  return points.map((point) => {
    const x = normalizeX(point.x);
    return { x: x < cut ? x + WORLD_WIDTH : x, y: point.y };
  });
}

export function wrapXNear(x: number, centerX: number): number {
  const normalized = normalizeX(x);
  const candidates = [normalized, normalized + WORLD_WIDTH];
  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate - centerX) < Math.abs(closest - centerX) ? candidate : closest
  ));
}

function normalizeX(x: number): number {
  return ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
