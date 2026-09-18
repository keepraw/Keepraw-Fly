import { geoEqualEarth, geoInterpolate, geoPath } from "d3-geo";
import type { RoutePoint } from "@keepraw-fly/core";
import {
  MAP_PROJECTION_SCALE,
  MAP_PROJECTION_TRANSLATE,
  WORLD_COUNTRIES,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "./world-map.generated";

export {
  WORLD_COUNTRIES,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
};

export interface GeographicPoint {
  longitude: number;
  latitude: number;
}

const mapProjection = geoEqualEarth()
  .scale(MAP_PROJECTION_SCALE)
  .translate([MAP_PROJECTION_TRANSLATE[0], MAP_PROJECTION_TRANSLATE[1]])
  .precision(0.25);
const mapPath = geoPath(mapProjection).digits(1);

export function projectPoint(point: GeographicPoint) {
  const projected = mapProjection([point.longitude, point.latitude]);
  if (!projected) throw new Error("Unable to project geographic point.");
  return { x: projected[0], y: projected[1] };
}

export function greatCirclePath(origin: RoutePoint, destination: RoutePoint, _steps = 40): string {
  const path = mapPath({
    type: "LineString",
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  });
  if (!path) throw new Error(`Unable to draw route ${origin.iata}-${destination.iata}.`);
  return path;
}

export function greatCircleMidpoint(origin: RoutePoint, destination: RoutePoint) {
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  const [longitude, latitude] = interpolate(0.5);
  return projectPoint({ longitude, latitude });
}

export function sampleGreatCircle(origin: RoutePoint, destination: RoutePoint, steps = 48) {
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  return Array.from({ length: steps + 1 }, (_, index) => {
    const [longitude, latitude] = interpolate(index / steps);
    return projectPoint({ longitude, latitude });
  });
}
