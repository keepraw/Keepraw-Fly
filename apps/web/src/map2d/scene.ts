import {
  routeIdentityKey,
  routePointIdentityKey,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";
import { projectionAt, regionalCenterLongitude } from "../data/map-geometry";
import {
  datelineCrossing,
  projectedRoute,
  type ProjectedPoint,
} from "./geometry";
import { routeTier } from "./theme-style";

export interface SceneRoute {
  key: string;
  origin: RoutePoint;
  destination: RoutePoint;
  flightCount: number;
  rank: number;
  tier: "base" | "frequent";
  segments: ProjectedPoint[][];
  crossesDateline: boolean;
}

export interface SceneAirport {
  identityKey: string;
  iata: string;
  x: number;
  y: number;
  longitude: number;
  latitude: number;
  flightCount: number;
  hub: boolean;
}

export interface MapScene {
  centerLongitude: number;
  routes: SceneRoute[];
  airports: SceneAirport[];
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export function buildMapScene(input: {
  routes: readonly RouteSegment[];
  centerLongitude?: number;
  hubCount?: number;
  steps?: number;
}): MapScene {
  const routeMap = new Map<
    string,
    {
      key: string;
      origin: RoutePoint;
      destination: RoutePoint;
      flightCount: number;
    }
  >();
  for (const route of input.routes) {
    if (
      routePointIdentityKey(route.origin) ===
      routePointIdentityKey(route.destination)
    )
      continue;
    const key = routeIdentityKey(route);
    const existing = routeMap.get(key);
    if (existing) existing.flightCount += route.flightCount;
    else
      routeMap.set(key, {
        key,
        origin: route.origin,
        destination: route.destination,
        flightCount: route.flightCount,
      });
  }

  const routesByRank = [...routeMap.values()].sort(
    (left, right) =>
      right.flightCount - left.flightCount || left.key.localeCompare(right.key),
  );
  const maxCount = routesByRank[0]?.flightCount ?? 0;
  const routeRanks = new Map(
    routesByRank.map((route, rank) => [route.key, rank]),
  );
  const endpointPoints = routesByRank.flatMap(({ origin, destination }) => [
    origin,
    destination,
  ]);
  const centerLongitude =
    input.centerLongitude ?? regionalCenterLongitude(endpointPoints);
  const sceneRoutes: SceneRoute[] = routesByRank
    .map((route) => ({
      ...route,
      rank: routeRanks.get(route.key)!,
      tier: routeTier(route.flightCount, maxCount),
      segments: projectedRoute(
        route.origin,
        route.destination,
        centerLongitude,
        input.steps,
      ),
      crossesDateline:
        datelineCrossing(route.origin, route.destination) !== null,
    }))
    .sort(
      (left, right) =>
        left.flightCount - right.flightCount ||
        left.key.localeCompare(right.key),
    );

  const airportMap = new Map<
    string,
    { point: RoutePoint; flightCount: number }
  >();
  for (const route of routesByRank) {
    for (const point of [route.origin, route.destination]) {
      const identityKey = routePointIdentityKey(point);
      const existing = airportMap.get(identityKey);
      if (existing) existing.flightCount += route.flightCount;
      else
        airportMap.set(identityKey, { point, flightCount: route.flightCount });
    }
  }
  const hubCount = Math.max(0, Math.floor(input.hubCount ?? 5));
  const hubIdentities = new Set(
    [...airportMap.entries()]
      .sort(
        ([leftIdentity, left], [rightIdentity, right]) =>
          right.flightCount - left.flightCount ||
          leftIdentity.localeCompare(rightIdentity),
      )
      .slice(0, hubCount)
      .map(([identityKey]) => identityKey),
  );
  const airports: SceneAirport[] = [...airportMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([identityKey, { point, flightCount }]) => {
      const projected = projectAirport(point, centerLongitude);
      return projected
        ? [
            {
              identityKey,
              iata: point.iata,
              x: projected.x,
              y: projected.y,
              longitude: point.longitude,
              latitude: point.latitude,
              flightCount,
              hub: hubIdentities.has(identityKey),
            },
          ]
        : [];
    });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasBounds = false;
  const includePoint = ({ x, y }: ProjectedPoint) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    hasBounds = true;
  };
  for (const route of sceneRoutes)
    for (const segment of route.segments)
      for (const point of segment) includePoint(point);
  for (const airport of airports) includePoint(airport);
  const bounds = hasBounds
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : null;

  return { centerLongitude, routes: sceneRoutes, airports, bounds };
}

function projectAirport(
  point: RoutePoint,
  centerLongitude: number,
): ProjectedPoint | null {
  const projected = projectionAt(centerLongitude)([
    point.longitude,
    point.latitude,
  ]);
  return projected ? { x: projected[0], y: projected[1] } : null;
}
