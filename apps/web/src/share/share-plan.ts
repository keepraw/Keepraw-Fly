import type { RouteSegment } from "@keepraw-fly/core";
import {
  geographicPoint,
  representativeGlobeDirection,
  type Vec3,
} from "../globe/globe-math";
import { FIXED_SUN_DIRECTION } from "../globe/globe-solar";
import { ShareRenderError } from "./share-errors";
import type { ShareGeoPoint, ShareRenderModel } from "./share-model";

/** The only output sizes of stage 3. Independent of window, CSS and DPR. */
export const SHARE_ARTBOARDS = {
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
} as const;
export type ShareArtboard = keyof typeof SHARE_ARTBOARDS;

/** Largest square globe layer; bounds the render-target memory budget
 * (2048² × RGBA16F × 4 MSAA samples ≈ 128 MiB worst case). */
export const MAX_GLOBE_LAYER_SIZE = 2048;

export interface ShareCamera {
  /** Geographic point at the centre of the globe layer. */
  lookAt: ShareGeoPoint;
  /** Camera distance from the Earth's centre in Earth radii (> 1.1). */
  distance: number;
  /** Vertical field of view in degrees. */
  fov: number;
}

export interface ShareGlobeLayer {
  /** Square layer in artboard pixels; may extend past the artboard edges. */
  x: number;
  y: number;
  size: number;
}

export interface ShareRouteStyle {
  color: string;
  /** Stroke width in artboard pixels at export quality. */
  width: number;
  opacity: number;
  markerColor: string;
  /** Marker radius in Earth radii. */
  markerRadius: number;
}

export interface ShareRenderPlan {
  artboard: ShareArtboard;
  width: number;
  height: number;
  globe: ShareGlobeLayer;
  camera: ShareCamera;
  theme: "dark" | "light";
  sunDirection: Vec3;
  routeStyle: ShareRouteStyle;
}

export interface ShareRenderPlanOptions {
  artboard: ShareArtboard;
  globe?: ShareGlobeLayer;
  camera?: ShareCamera;
  theme?: "dark" | "light";
  routeStyle?: Partial<ShareRouteStyle>;
}

const DEFAULT_FOV = 30;

/** Distance at which the atmosphere's disc spans `fill` of the layer. */
export function fittedCameraDistance(fov = DEFAULT_FOV, fill = 0.94) {
  const half = (fov * Math.PI) / 360;
  return 1.026 / Math.sin(Math.atan(fill * Math.tan(half)));
}

/**
 * Fixed, trip-independent framing used whenever routes are not shared. It is
 * the same constant direction the interactive globe uses for an empty
 * archive, so an overview image never encodes where the traveller flew.
 */
export const FIXED_OVERVIEW_CAMERA: ShareCamera = Object.freeze({
  lookAt: Object.freeze({ latitude: 30, longitude: 110 }),
  distance: fittedCameraDistance(),
  fov: DEFAULT_FOV,
});

/** Route-aware framing; only meaningful (and only allowed) in "routes" mode. */
export function routeFramingCamera(model: ShareRenderModel): ShareCamera {
  if (model.privacy !== "routes" || !model.routes.length)
    return FIXED_OVERVIEW_CAMERA;
  // Synthetic, coordinate-derived keys: the model holds no airport codes
  // unless labels were granted, and the framing must not depend on them.
  const key = (p: ShareGeoPoint) => `${p.latitude},${p.longitude}`;
  const segments: RouteSegment[] = model.routes.map((route) => ({
    origin: { iata: key(route.from), ...route.from },
    destination: { iata: key(route.to), ...route.to },
    flightCount: route.flights,
  }));
  return {
    lookAt: geographicPoint(representativeGlobeDirection(segments)),
    distance: fittedCameraDistance(),
    fov: DEFAULT_FOV,
  };
}

const finite = (...values: number[]) => values.every(Number.isFinite);

export function validateShareRenderPlan(plan: ShareRenderPlan): void {
  const fail = (message: string) => {
    throw new ShareRenderError("invalid-plan", message);
  };
  const board = SHARE_ARTBOARDS[plan.artboard];
  if (!board || board.width !== plan.width || board.height !== plan.height)
    fail(`Unsupported artboard ${plan.artboard} ${plan.width}x${plan.height}`);
  const { x, y, size } = plan.globe;
  if (!finite(x, y, size) || !Number.isInteger(size) || size < 16)
    fail("The globe layer needs finite coordinates and an integer size ≥ 16");
  if (size > MAX_GLOBE_LAYER_SIZE)
    fail(`The globe layer exceeds ${MAX_GLOBE_LAYER_SIZE}px`);
  const { lookAt, distance, fov } = plan.camera;
  if (
    !finite(lookAt.latitude, lookAt.longitude, distance, fov) ||
    Math.abs(lookAt.latitude) > 90 ||
    Math.abs(lookAt.longitude) > 180 ||
    distance <= 1.1 ||
    distance > 50 ||
    fov <= 1 ||
    fov >= 120
  )
    fail("Invalid camera");
  const style = plan.routeStyle;
  if (
    !finite(style.width, style.opacity, style.markerRadius) ||
    style.width <= 0
  )
    fail("Invalid route style");
}

export function createShareRenderPlan(
  model: ShareRenderModel,
  options: ShareRenderPlanOptions,
): ShareRenderPlan {
  const board = SHARE_ARTBOARDS[options.artboard];
  if (!board)
    throw new ShareRenderError("invalid-plan", "Unsupported artboard");
  const size = Math.min(board.width, MAX_GLOBE_LAYER_SIZE);
  const plan: ShareRenderPlan = {
    artboard: options.artboard,
    width: board.width,
    height: board.height,
    globe: options.globe ?? {
      x: 0,
      y: Math.round((board.height - size) / 2),
      size,
    },
    // Without shared routes the camera is always the fixed overview framing;
    // an explicit camera is honoured only in "routes" mode.
    camera:
      model.privacy === "routes"
        ? (options.camera ?? routeFramingCamera(model))
        : FIXED_OVERVIEW_CAMERA,
    theme: options.theme ?? "dark",
    sunDirection: FIXED_SUN_DIRECTION,
    routeStyle: {
      color: "#8fd3ff",
      width: 2.4,
      opacity: 0.9,
      markerColor: "#d6efff",
      markerRadius: 0.0065,
      ...options.routeStyle,
    },
  };
  validateShareRenderPlan(plan);
  return plan;
}
