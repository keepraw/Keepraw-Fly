import { geoArea, geoEqualEarth, geoInterpolate, geoPath } from "d3-geo";
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

function projectionAt(longitude: number) {
  return longitude === 0
    ? mapProjection
    : geoEqualEarth()
        .rotate([-longitude, 0])
        .scale(MAP_PROJECTION_SCALE)
        .translate([MAP_PROJECTION_TRANSLATE[0], MAP_PROJECTION_TRANSLATE[1]])
        .precision(0.25);
}

export function projectPoint(point: GeographicPoint, centerLongitude = 0) {
  const projected = projectionAt(centerLongitude)([
    point.longitude,
    point.latitude,
  ]);
  if (!projected) throw new Error("Unable to project geographic point.");
  return { x: projected[0], y: projected[1] };
}

export function greatCirclePath(
  origin: RoutePoint,
  destination: RoutePoint,
  _steps = 40,
  centerLongitude = 0,
): string {
  const path = (
    centerLongitude === 0
      ? mapPath
      : geoPath(projectionAt(centerLongitude)).digits(1)
  )({
    type: "LineString",
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  });
  if (!path)
    throw new Error(`Unable to draw route ${origin.iata}-${destination.iata}.`);
  return path;
}

export function greatCircleMidpoint(
  origin: RoutePoint,
  destination: RoutePoint,
  centerLongitude = 0,
) {
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  const [longitude, latitude] = interpolate(0.5);
  return projectPoint({ longitude, latitude }, centerLongitude);
}

export function sampleGreatCircle(
  origin: RoutePoint,
  destination: RoutePoint,
  steps = 48,
  centerLongitude = 0,
) {
  const interpolate = geoInterpolate(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  const projection = projectionAt(centerLongitude);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const [longitude, latitude] = interpolate(index / steps);
    const [x, y] = projection([longitude, latitude])!;
    return { x, y };
  });
}

export function regionalCenterLongitude(points: GeographicPoint[]): number {
  if (!points.length) return 0;
  const longitudes = points.map((point) => point.longitude);
  const span = Math.max(...longitudes) - Math.min(...longitudes);
  return span > 150
    ? 0
    : (Math.max(...longitudes) + Math.min(...longitudes)) / 2;
}

// Reproject the existing offline M/L/Z polygons. Inverting their pinned world
// projection keeps the same coastline data and avoids another map download.
export function regionalWorldPaths(centerLongitude: number) {
  if (centerLongitude === 0)
    return {
      countries: WORLD_COUNTRIES,
      land: WORLD_LAND_PATH,
      sphere: WORLD_SPHERE_PATH,
    };
  const path = geoPath(projectionAt(centerLongitude)).digits(1);
  const reproject = (svgPath: string) => {
    const coordinates = svgPath
      .split("M")
      .filter(Boolean)
      .map((ring) => {
        const numbers = ring.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const points: [number, number][] = [];
        for (let i = 0; i < numbers.length; i += 2) {
          const geographic = mapProjection.invert!([
            numbers[i]!,
            numbers[i + 1]!,
          ]);
          if (geographic) {
            // Restore exact clip edges rounded in the generated SVG; a near-pole
            // vertex can otherwise make the polar cap fill the opposite hemisphere.
            if (Math.abs(geographic[1]) > 89.9)
              geographic[1] = Math.sign(geographic[1]) * 90;
            if (Math.abs(geographic[0]) > 179.9)
              geographic[0] = Math.sign(geographic[0]) * 180;
            points.push(geographic);
          }
        }
        if (points.length) points.push(points[0]!);
        return points;
      });
    const polygon = { type: "Polygon" as const, coordinates };
    // Clipped rings near the original date-line seam can invert their winding
    // after rounding/inversion. Every country is smaller than a hemisphere.
    if (geoArea(polygon) > Math.PI * 2)
      coordinates.forEach((ring) => ring.reverse());
    return path(polygon) ?? "";
  };
  return {
    countries: WORLD_COUNTRIES.map((country) => ({
      ...country,
      path: reproject(country.path),
    })),
    land: reproject(WORLD_LAND_PATH),
    sphere: path({ type: "Sphere" }) ?? WORLD_SPHERE_PATH,
  };
}
