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

/** Smallest geographic span a route frame shows, in degrees of longitude at
 * the equator (and the matching height). One or two short hops are framed
 * with their surroundings instead of being magnified until the coastline
 * outlines break up. */
export const POSTER_MIN_FRAME_DEGREES = 45;
/** Uniform clearance (poster units) between the framed routes/airports and
 * the map rectangle: covers the busiest-airport ring and stroke widths. */
export const POSTER_FRAME_MARGIN = 48;

export interface PosterMapFrame {
  /** Map-unit box drawn into the poster rect. */
  crop: { x: number; y: number; width: number; height: number };
  /** Map unit → poster unit. */
  scale: number;
  /** Poster-unit offset of the crop's top-left corner. */
  offsetX: number;
  offsetY: number;
  centerLongitude: number;
  /** Poster-unit area that actually shows map: the rect intersected with
   * the inhabited latitude band (83° N … 57° S). */
  visible: { x: number; y: number; width: number; height: number };
  /** True when the frame fits the recorded routes, false for the world. */
  fitted: boolean;
}

export interface PosterRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Geography a frame must keep in view: plottable airports and routes. */
export interface PosterFrameContent {
  routes: ReadonlyArray<{ from: ShareGeoPoint; to: ShareGeoPoint }>;
  airports: ReadonlyArray<ShareGeoPoint>;
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

/** Map-unit samples of every great circle (mid-route bulge included) and
 * every airport, projected around `centerLongitude`. */
function contentSamples(content: PosterFrameContent, centerLongitude: number) {
  const projection = projectionAt(centerLongitude);
  const points: Array<[number, number]> = [];
  for (const route of content.routes) {
    const a: [number, number] = [route.from.longitude, route.from.latitude];
    const b: [number, number] = [route.to.longitude, route.to.latitude];
    const degrees = (geoDistance(a, b) * 180) / Math.PI;
    // Same sampling density as routePolylines, so the frame bounds exactly
    // the polylines that are drawn.
    const steps = Math.max(12, Math.ceil(degrees / 1.5));
    const interpolate = geoInterpolate(a, b);
    for (let index = 0; index <= steps; index += 1) {
      const projected = projection(interpolate(index / steps));
      if (projected) points.push([projected[0], projected[1]]);
    }
  }
  for (const airport of content.airports) {
    const projected = projection([airport.longitude, airport.latitude]);
    if (projected) points.push([projected[0], projected[1]]);
  }
  return points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

/** The whole inhabited world fitted into `rect` (the no-route fallback). */
function worldFrame(rect: PosterRectLike, centerLongitude: number) {
  const crop = posterMapCrop();
  const scale = Math.min(rect.width / crop.width, rect.height / crop.height);
  const offsetX = rect.x + (rect.width - crop.width * scale) / 2;
  const offsetY = rect.y + (rect.height - crop.height * scale) / 2;
  return {
    crop,
    scale,
    offsetX,
    offsetY,
    centerLongitude,
    visible: {
      x: rect.x,
      y: offsetY,
      width: rect.width,
      height: crop.height * scale,
    },
    fitted: false,
  };
}

/**
 * Frames the map on the recorded geography. Every airport and every sampled
 * great-circle point (so a long route's bulge is never cut) is bounded,
 * then fitted into `rect` with a uniform `POSTER_FRAME_MARGIN`, without
 * distorting either axis of the Equal Earth projection. A minimum span keeps
 * one or two short hops from being over-magnified. With nothing to frame it
 * falls back to the whole inhabited world. The centre longitude (and so the
 * seam split of routePolylines) is the caller's, unchanged.
 */
export function posterMapFrame(
  rect: PosterRectLike,
  centerLongitude = 0,
  content?: PosterFrameContent,
): PosterMapFrame {
  const samples = content ? contentSamples(content, centerLongitude) : [];
  if (!samples.length) return worldFrame(rect, centerLongitude);
  const world = posterMapCrop();
  const worldScale = Math.min(
    rect.width / world.width,
    rect.height / world.height,
  );
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of samples) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const unitsPerDegree =
    projectionAt(0)([1, 0])![0] - projectionAt(0)([0, 0])![0];
  const minSpan = POSTER_MIN_FRAME_DEGREES * unitsPerDegree;
  const innerWidth = Math.max(1, rect.width - POSTER_FRAME_MARGIN * 2);
  const innerHeight = Math.max(1, rect.height - POSTER_FRAME_MARGIN * 2);
  // Content fit with margins, capped by the minimum span (in the rect's
  // own aspect), and never zoomed out past what the world fit needs.
  const fit = Math.min(
    innerWidth / Math.max(maxX - minX, 1e-6),
    innerHeight / Math.max(maxY - minY, 1e-6),
  );
  const cap = Math.min(
    rect.width / minSpan,
    rect.height / ((minSpan * rect.height) / rect.width),
  );
  let scale = Math.min(fit, cap);
  // A world-spanning archive still fills the map like the world frame does
  // when its content (without the margin) fits at that scale.
  if (
    scale < worldScale &&
    (maxX - minX) * worldScale <= rect.width &&
    (maxY - minY) * worldScale <= rect.height
  )
    scale = worldScale;
  const width = rect.width / scale;
  const height = rect.height / scale;
  // Centre on the content, then slide (never past the content) towards the
  // inhabited band so a frame wastes as little height on empty paper as
  // possible.
  const slide = (
    start: number,
    size: number,
    low: number,
    high: number,
    contentLow: number,
    contentHigh: number,
  ) => {
    let value = start;
    if (size <= high - low) value = Math.min(Math.max(value, low), high - size);
    else value = low + (high - low - size) / 2;
    // The content always wins over the band. When content plus margins is
    // wider than the frame (world-scale fallback), split the shortfall.
    if (contentHigh - contentLow > size)
      return (contentLow + contentHigh - size) / 2;
    value = Math.min(value, contentLow);
    value = Math.max(value, contentHigh - size);
    return value;
  };
  const cropX = slide(
    (minX + maxX) / 2 - width / 2,
    width,
    world.x,
    world.x + world.width,
    minX - POSTER_FRAME_MARGIN / scale,
    maxX + POSTER_FRAME_MARGIN / scale,
  );
  const cropY = slide(
    (minY + maxY) / 2 - height / 2,
    height,
    world.y,
    world.y + world.height,
    minY - POSTER_FRAME_MARGIN / scale,
    maxY + POSTER_FRAME_MARGIN / scale,
  );
  const crop = { x: cropX, y: cropY, width, height };
  const bandTop = rect.y + (world.y - cropY) * scale;
  const bandBottom = rect.y + (world.y + world.height - cropY) * scale;
  // A polar route may rise above the inhabited band; it is never clipped.
  const contentTop = rect.y + (minY - cropY) * scale - POSTER_FRAME_MARGIN;
  const contentBottom = rect.y + (maxY - cropY) * scale + POSTER_FRAME_MARGIN;
  const top = Math.max(rect.y, Math.min(bandTop, contentTop));
  const bottom = Math.min(
    rect.y + rect.height,
    Math.max(bandBottom, contentBottom),
  );
  return {
    crop,
    scale,
    offsetX: rect.x,
    offsetY: rect.y,
    centerLongitude,
    visible: {
      x: rect.x,
      y: top,
      width: rect.width,
      height: Math.max(0, bottom - top),
    },
    fitted: true,
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
