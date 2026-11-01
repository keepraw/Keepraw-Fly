import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  arrivalIdentity,
  originIdentity,
  type FlightEndpointIdentity,
  type PossibleAirportPosition,
} from "./flight-airports";

export interface RoutePoint {
  iata: string;
  /** Physical identity (`airport:<apt_>` or `current:<IATA>`); distinct sites never share it. */
  identityKey?: string;
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  origin: RoutePoint;
  destination: RoutePoint;
  flightCount: number;
}

/** A position that is only a possibility (formal boundary or historical candidate); never a route end. */
export interface UncertainAirportMarker extends PossibleAirportPosition {
  iata: string;
  identityKey: string;
  flightCount: number;
}

function point(identity: FlightEndpointIdentity): RoutePoint | null {
  if (!identity.confirmed || !identity.point) return null;
  const { latitude, longitude } = identity.point;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    iata: identity.iata,
    identityKey: identity.identityKey,
    latitude,
    longitude,
  };
}

/**
 * Routes are drawn only between confirmed flight-date airports. A flight with an
 * undetermined endpoint draws no route (see {@link buildUncertainAirportMarkers}).
 */
export function buildRouteSegments(flights: KeeprawFlight[]): RouteSegment[] {
  const routes = new Map<string, RouteSegment>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    const origin = point(originIdentity(flight));
    const destination = point(arrivalIdentity(flight));
    if (!origin || !destination) continue;
    const key = `${origin.identityKey}>${destination.identityKey}`;
    const existing = routes.get(key);
    if (existing) existing.flightCount += 1;
    else routes.set(key, { origin, destination, flightCount: 1 });
  }
  return [...routes.values()];
}

/** Possible positions of undetermined endpoints, for clearly marked "possible location" rendering. */
export function buildUncertainAirportMarkers(
  flights: KeeprawFlight[],
): UncertainAirportMarker[] {
  const markers = new Map<string, UncertainAirportMarker>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (identity.confirmed) continue;
      for (const position of identity.possiblePositions) {
        const key = `${identity.iata}|${position.siteId}`;
        const existing = markers.get(key);
        if (existing) existing.flightCount += 1;
        else
          markers.set(key, {
            ...position,
            iata: identity.iata,
            identityKey: identity.identityKey,
            flightCount: 1,
          });
      }
    }
  }
  return [...markers.values()].sort(
    (a, b) => a.iata.localeCompare(b.iata) || a.siteId.localeCompare(b.siteId),
  );
}
