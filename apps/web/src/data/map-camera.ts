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

export function fitProjectedPoints(
  points: ProjectedPoint[],
  options: { maxZoom: number; padding: number },
): MapCamera {
  if (points.length === 0) return WORLD_CAMERA;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
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
