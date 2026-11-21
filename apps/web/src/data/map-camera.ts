import type { RouteSegment } from "@keepraw-fly/core";
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
  insetBottom = 0,
): MapCamera {
  const usableHeight = Math.max(100, viewportHeight - insetBottom);
  if (
    routes.some(
      (route) =>
        Math.abs(route.origin.longitude - route.destination.longitude) > 180,
    )
  )
    return passportWorldCamera(usableHeight);
  const centerLongitude = regionalCenterLongitude(airports);
  function* projectedPoints() {
    for (const airport of airports)
      yield projectPoint(airport, centerLongitude);
    for (const route of routes) {
      yield* sampleGreatCircle(
        route.origin,
        route.destination,
        48,
        centerLongitude,
      );
    }
  }
  const camera = fitProjectedPoints(projectedPoints(), {
    maxZoom: 6,
    padding: 0.16,
    viewportHeight: usableHeight,
  });
  return camera === WORLD_CAMERA
    ? passportWorldCamera(usableHeight)
    : {
        ...camera,
        centerY: camera.centerY + insetBottom / (2 * camera.zoom),
      };
}

function passportWorldCamera(viewportHeight: number): MapCamera {
  // The SVG Passport overview needs a scale below 1 to retain polar routes
  // in a wide, short stage.
  return {
    ...WORLD_CAMERA,
    zoom: Math.min(0.94, (viewportHeight / WORLD_HEIGHT) * 0.9),
  };
}

export function fitProjectedPoints(
  points: Iterable<ProjectedPoint>,
  options: { maxZoom: number; padding: number; viewportHeight?: number },
): MapCamera {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return WORLD_CAMERA;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (minX === Infinity) return WORLD_CAMERA;
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
    centerX: minX / 2 + maxX / 2,
    centerY: minY / 2 + maxY / 2,
    zoom,
  };
}
