import { geoInterpolate } from "d3-geo";
import {
  greatCirclePath,
  projectionAt,
  regionalWorldPaths,
  sampleGreatCircle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GeographicPoint,
} from "../data/map-geometry";
import type { NeonAirport } from "./sample-network";

export {
  greatCirclePath,
  projectionAt,
  regionalWorldPaths,
  WORLD_HEIGHT,
  WORLD_WIDTH,
};

export interface NeonProjectedPoint {
  x: number;
  y: number;
}

export interface NeonRouteFrame {
  centerLongitude: number;
  x: number;
  y: number;
  width: number;
  height: number;
  viewBox: string;
}

export interface NeonDatelinePoint extends NeonProjectedPoint {
  longitude: 180 | -180;
  latitude: number;
}

export function routeCenterLongitude(
  origin: NeonAirport,
  destination: NeonAirport,
): number {
  const [longitude] = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  )(0.5);
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return Math.abs(wrapped + 180) < 1e-8 ? 180 : wrapped;
}

export function routeFrame(
  origin: NeonAirport,
  destination: NeonAirport,
  aspect: number,
  padding: number,
): NeonRouteFrame {
  const centerLongitude = routeCenterLongitude(origin, destination);
  const points = sampleGreatCircle(origin, destination, 96, centerLongitude);
  points.push(
    project(origin, centerLongitude),
    project(destination, centerLongitude),
  );
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
  origin: NeonAirport,
  destination: NeonAirport,
): NeonDatelinePoint | null {
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  const samples = 128;
  let previousFraction = 0;
  let previousLongitude = interpolate(0)[0];
  for (let index = 1; index <= samples; index += 1) {
    const fraction = index / samples;
    const longitude = interpolate(fraction)[0];
    if (Math.abs(longitude - previousLongitude) > 180) {
      const target = previousLongitude >= 0 ? 180 : -180;
      let low = previousFraction;
      let high = fraction;
      const increasing = target === 180;
      for (let step = 0; step < 32; step += 1) {
        const middle = (low + high) / 2;
        const raw = interpolate(middle)[0];
        const unwrapped =
          raw + 360 * Math.round((previousLongitude - raw) / 360);
        if (unwrapped < target === increasing) low = middle;
        else high = middle;
      }
      const [, latitude] = interpolate((low + high) / 2);
      const centerLongitude = routeCenterLongitude(origin, destination);
      const projected = projectionAt(centerLongitude)([target, latitude]);
      return projected
        ? { longitude: target, latitude, x: projected[0], y: projected[1] }
        : null;
    }
    previousFraction = fraction;
    previousLongitude = longitude;
  }
  return null;
}

function project(point: GeographicPoint, centerLongitude: number) {
  const result = projectionAt(centerLongitude)([
    point.longitude,
    point.latitude,
  ]);
  if (!result) throw new Error("Unable to project a sample airport.");
  return { x: result[0], y: result[1] };
}
