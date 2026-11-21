import type { RoutePoint } from "@keepraw-fly/core";
import {
  greatCircleMidpoint,
  projectionAt,
  sampleGreatCircle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GeographicPoint,
} from "../data/map-geometry";

export { WORLD_HEIGHT, WORLD_WIDTH };

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface RouteFrame {
  centerLongitude: number;
  x: number;
  y: number;
  width: number;
  height: number;
  viewBox: string;
}

export interface DatelinePoint extends ProjectedPoint {
  longitude: 180 | -180;
  latitude: number;
}

export function projectedRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  centerLongitude: number,
  steps = 48,
): ProjectedPoint[][] {
  const points = sampleGreatCircle(
    origin,
    destination,
    Math.max(1, Math.floor(steps)),
    centerLongitude,
  );
  const segments: ProjectedPoint[][] = [];
  let current: ProjectedPoint[] = [];
  for (const point of points) {
    if (
      current.length &&
      Math.abs(point.x - current[current.length - 1]!.x) > WORLD_WIDTH * 0.4
    ) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments.filter((segment) => segment.length > 1);
}

export function routeCenterLongitude(
  origin: RoutePoint,
  destination: RoutePoint,
): number {
  const midpoint = greatCircleMidpoint(origin, destination);
  const geographic = projectionAt(0).invert?.([midpoint.x, midpoint.y]);
  const longitude =
    geographic?.[0] ??
    origin.longitude +
      (((((destination.longitude - origin.longitude + 540) % 360) + 360) %
        360) -
        180) /
        2;
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return Math.abs(wrapped + 180) < 1e-8 ? 180 : wrapped;
}

export function routeFrame(
  origin: RoutePoint,
  destination: RoutePoint,
  aspect: number,
  padding: number,
): RouteFrame {
  const centerLongitude = routeCenterLongitude(origin, destination);
  const points = sampleGreatCircle(origin, destination, 96, centerLongitude);
  const project = (point: GeographicPoint) => {
    const result = projectionAt(centerLongitude)([
      point.longitude,
      point.latitude,
    ]);
    if (!result) throw new Error("Unable to project a sample airport.");
    return { x: result[0], y: result[1] };
  };
  points.push(project(origin), project(destination));
  let minX = Math.min(...points.map((point) => point.x));
  let maxX = Math.max(...points.map((point) => point.x));
  let minY = Math.min(...points.map((point) => point.y));
  let maxY = Math.max(...points.map((point) => point.y));
  const safePadding = Math.max(0, Math.min(0.45, padding));
  let width = Math.max(1, (maxX - minX) / (1 - safePadding * 2));
  let height = Math.max(1, (maxY - minY) / (1 - safePadding * 2));
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  if (width / height < safeAspect) width = height * safeAspect;
  else height = width / safeAspect;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  minX = centerX - width / 2;
  minY = centerY - height / 2;
  return {
    centerLongitude,
    x: minX,
    y: minY,
    width,
    height,
    viewBox: `${minX} ${minY} ${width} ${height}`,
  };
}

export function datelineCrossing(
  origin: RoutePoint,
  destination: RoutePoint,
): DatelinePoint | null {
  const projection = projectionAt(0);
  const points = sampleGreatCircle(origin, destination, 128, 0);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (Math.abs(current.x - previous.x) <= WORLD_WIDTH * 0.4) continue;
    const previousGeographic = projection.invert?.([previous.x, previous.y]);
    const currentGeographic = projection.invert?.([current.x, current.y]);
    if (!previousGeographic || !currentGeographic) return null;
    const longitude = previous.x > current.x ? 180 : -180;
    const latitude = (previousGeographic[1] + currentGeographic[1]) / 2;
    const projected = projectionAt(routeCenterLongitude(origin, destination))([
      longitude,
      latitude,
    ]);
    return projected
      ? { longitude, latitude, x: projected[0], y: projected[1] }
      : null;
  }
  return null;
}
