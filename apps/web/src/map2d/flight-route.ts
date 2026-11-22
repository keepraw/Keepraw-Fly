import {
  buildRouteSegments,
  plannedDestinationIdentity,
  type FlightEndpointIdentity,
  type RoutePoint,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  fitProjectedPoints,
  WORLD_CAMERA,
  type MapCamera,
} from "../data/map-camera";
import {
  projectPoint,
  sampleGreatCircle,
  WORLD_HEIGHT,
} from "../data/map-geometry";
import { routeCenterLongitude } from "./geometry";

export interface FlightRouteScene {
  status: "flown" | "diverted" | "cancelled" | "unavailable";
  centerLongitude: number;
  /** Flown leg: origin to the actual arrival (the diversion airport if any). */
  origin?: RoutePoint;
  arrival?: RoutePoint;
  /** Planned destination of a diverted flight, when it has coordinates. */
  planned?: RoutePoint;
}

export const FLIGHT_ROUTE_MAX_ZOOM = 16;

function routePoint(identity: FlightEndpointIdentity): RoutePoint | undefined {
  return identity.point
    ? {
        iata: identity.iata,
        identityKey: identity.identityKey,
        latitude: identity.point.latitude,
        longitude: identity.point.longitude,
      }
    : undefined;
}

/** Single-flight map model built on the core flight-date identities. */
export function flightRouteScene(flight: KeeprawFlight): FlightRouteScene {
  if (flight.cancelled) return { status: "cancelled", centerLongitude: 0 };
  // Core decides whether the flown leg is drawable, as on the Passport map.
  const [route] = buildRouteSegments([flight]);
  if (!route) return { status: "unavailable", centerLongitude: 0 };
  const planned = flight.divertedTo
    ? routePoint(plannedDestinationIdentity(flight))
    : undefined;
  return {
    status: flight.divertedTo ? "diverted" : "flown",
    centerLongitude: routeCenterLongitude(route.origin, route.destination),
    origin: route.origin,
    arrival: route.destination,
    planned:
      planned && planned.identityKey !== route.destination.identityKey
        ? planned
        : undefined,
  };
}

/** Frames the flown leg (and a planned destination) around the route center. */
export function flightRouteCamera(
  scene: FlightRouteScene,
  viewportHeight = WORLD_HEIGHT,
): MapCamera {
  const { origin, arrival, planned, centerLongitude } = scene;
  if (!origin || !arrival) return WORLD_CAMERA;
  const points = sampleGreatCircle(origin, arrival, 96, centerLongitude);
  points.push(projectPoint(origin, centerLongitude));
  points.push(projectPoint(arrival, centerLongitude));
  if (planned)
    points.push(
      ...sampleGreatCircle(origin, planned, 48, centerLongitude),
      projectPoint(planned, centerLongitude),
    );
  return fitProjectedPoints(points, {
    maxZoom: FLIGHT_ROUTE_MAX_ZOOM,
    padding: 0.2,
    viewportHeight,
  });
}
