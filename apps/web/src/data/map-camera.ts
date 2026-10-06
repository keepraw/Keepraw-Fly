import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
import {
  projectPoint,
  sampleGreatCircle,
  regionalCenterLongitude,
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
  viewportHeight = WORLD_HEIGHT,
): MapCamera {
  if (
    routes.some(
      (route) =>
        Math.abs(route.origin.longitude - route.destination.longitude) > 180,
    )
  )
    return WORLD_CAMERA;
  const centerLongitude = regionalCenterLongitude(airports);
  const points = [
    ...airports.map((airport) => projectPoint(airport, centerLongitude)),
    ...routes.flatMap((route) =>
      sampleGreatCircle(route.origin, route.destination, 48, centerLongitude),
    ),
  ];
  return fitProjectedPoints(points, {
    maxZoom: 8,
    padding: 0.12,
    viewportHeight,
  });
}

export function flightRouteCamera(
  origin: RoutePoint,
  destination: RoutePoint,
  viewportHeight = WORLD_HEIGHT,
): MapCamera {
  if (Math.abs(origin.longitude - destination.longitude) > 180)
    return WORLD_CAMERA;
  return fitProjectedPoints(
    sampleGreatCircle(
      origin,
      destination,
      72,
      regionalCenterLongitude([origin, destination]),
    ),
    {
      maxZoom: 12,
      padding: 0.09,
      viewportHeight,
    },
  );
}

export function fitProjectedPoints(
  points: ProjectedPoint[],
  options: { maxZoom: number; padding: number; viewportHeight?: number },
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
  const availableHeight =
    (options.viewportHeight ?? WORLD_HEIGHT) * (1 - options.padding * 2);
  const zoom = Math.min(
    options.maxZoom,
    availableWidth / spanX,
    availableHeight / spanY,
  );

  // Truly global/date-line-spanning geometry needs the full world. Regional
  // bounds retain their center even when the fit is only slightly above 1.
  if (spanX >= WORLD_WIDTH * 0.9 || zoom < 1) return WORLD_CAMERA;

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    zoom,
  };
}
