import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { RoutePoint } from "@keepraw-fly/core";
import {
  MAP_PROJECTION_SCALE,
  MAP_PROJECTION_TRANSLATE,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "./world-map.generated";

export {
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

const mapProjection = geoNaturalEarth1()
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
