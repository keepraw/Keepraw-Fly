import { geoDistance, geoGraticule10, geoInterpolate, geoPath } from "d3-geo";
import {
  projectionAt,
  regionalWorldPaths,
  WORLD_WIDTH,
} from "../data/map-geometry";
import type { ShareGeoPoint } from "./share-model";

/**
 * Poster map geometry: the app's existing offline Equal Earth world map
 * (`world-map.generated.ts` via `map-geometry.ts`), reprojected around a
 * centre longitude and cropped to inhabited latitudes. Everything here is
 * plain math on map units; the Canvas 2D drawing lives in poster-render.ts.
 * No new map asset, no globe, no WebGL.
 */

/** Northern and southern crop of the poster map (drops most of Antarctica). */
export const POSTER_MAP_NORTH = 83;
export const POSTER_MAP_SOUTH = -57;

export interface PosterMapFrame {
  /** Map-unit box drawn into the poster rect. */
  crop: { x: number; y: number; width: number; height: number };
  /** Map unit → poster unit. */
  scale: number;
  /** Poster-unit offset of the crop's top-left corner. */
  offsetX: number;
  offsetY: number;
  centerLongitude: number;
}

export interface PosterRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

const projectedY = (latitude: number) => projectionAt(0)([0, latitude])![1];

/** Map-unit crop box: the full sphere width, inhabited latitudes only. */
export function posterMapCrop() {
  const top = projectedY(POSTER_MAP_NORTH);
  const bottom = projectedY(POSTER_MAP_SOUTH);
  const left = projectionAt(0)([-180, 0])![0];
  const right = projectionAt(0)([180, 0])![0];
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Aspect ratio (width / height) of the cropped poster map. */
export const POSTER_MAP_RATIO = (() => {
  const crop = posterMapCrop();
  return crop.width / crop.height;
})();

/** Fits the cropped map into `rect`, centred, without distortion. */
export function posterMapFrame(
  rect: PosterRectLike,
  centerLongitude = 0,
): PosterMapFrame {
  const crop = posterMapCrop();
  const scale = Math.min(rect.width / crop.width, rect.height / crop.height);
  return {
    crop,
    scale,
    offsetX: rect.x + (rect.width - crop.width * scale) / 2,
    offsetY: rect.y + (rect.height - crop.height * scale) / 2,
    centerLongitude,
  };
}

export function framePoint(
  frame: PosterMapFrame,
  point: { x: number; y: number },
) {
  return {
    x: frame.offsetX + (point.x - frame.crop.x) * frame.scale,
    y: frame.offsetY + (point.y - frame.crop.y) * frame.scale,
  };
}

/** A geographic point in poster units, or null when it cannot project. */
export function projectToFrame(frame: PosterMapFrame, point: ShareGeoPoint) {
  const projected = projectionAt(frame.centerLongitude)([
    point.longitude,
    point.latitude,
  ]);
  return projected
    ? framePoint(frame, { x: projected[0], y: projected[1] })
    : null;
}

export interface PosterWorldPaths {
  land: string;
  borders: string;
  sphere: string;
  graticule: string;
}

const worldCache = new Map<number, PosterWorldPaths>();

/** SVG path strings (map units) for land, borders, outline and graticule. */
export function posterWorldPaths(centerLongitude: number): PosterWorldPaths {
  const cached = worldCache.get(centerLongitude);
  if (cached) return cached;
  const paths = regionalWorldPaths(centerLongitude);
  const value: PosterWorldPaths = {
    land: paths.land,
    borders: paths.countries.map((country) => country.path).join(""),
    sphere: paths.sphere,
    graticule:
      geoPath(projectionAt(centerLongitude)).digits(1)(geoGraticule10()) ?? "",
  };
  worldCache.set(centerLongitude, value);
  return value;
}

/**
 * The great circle between two airports as poster-unit polylines. The line is
 * split where it crosses the map's seam, so a trans-Pacific route never draws
 * a stroke across the whole map.
 */
export function routePolylines(
  frame: PosterMapFrame,
  from: ShareGeoPoint,
  to: ShareGeoPoint,
): Array<Array<{ x: number; y: number }>> {
  const a: [number, number] = [from.longitude, from.latitude];
  const b: [number, number] = [to.longitude, to.latitude];
  const degrees = (geoDistance(a, b) * 180) / Math.PI;
  const steps = Math.max(12, Math.ceil(degrees / 1.5));
  const interpolate = geoInterpolate(a, b);
  const projection = projectionAt(frame.centerLongitude);
  const lines: Array<Array<{ x: number; y: number }>> = [[]];
  let previous: [number, number] | null = null;
  for (let index = 0; index <= steps; index += 1) {
    const projected = projection(interpolate(index / steps));
    if (!projected) continue;
    if (previous && Math.abs(projected[0] - previous[0]) > WORLD_WIDTH * 0.4)
      lines.push([]);
    lines[lines.length - 1]!.push(
      framePoint(frame, { x: projected[0], y: projected[1] }),
    );
    previous = projected;
  }
  return lines.filter((line) => line.length > 1);
}
