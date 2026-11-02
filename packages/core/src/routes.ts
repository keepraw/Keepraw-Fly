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

// ------------------------------------------------------------ selection ---

/**
 * A selected airport. `identityKey` is the flight-date physical identity
 * (`airport:<apt_>` or `current:<IATA>`); `code` is kept for display and for
 * older transient selections that carry no identity (matched by code).
 */
export interface AirportSelectionTarget {
  kind: "airport";
  code: string;
  identityKey?: string;
}

/** A selected directed route between two physical identities. */
export interface RouteSelectionTarget {
  kind: "route";
  origin: string;
  destination: string;
  originIdentityKey?: string;
  destinationIdentityKey?: string;
}

/** Physical identity of a route end; falls back to the code for legacy points. */
export function routePointIdentityKey(point: {
  iata: string;
  identityKey?: string;
}): string {
  return point.identityKey ?? point.iata;
}

/** Directed physical route key; two routes that only share codes never collide. */
export function routeIdentityKey(route: {
  origin: { iata: string; identityKey?: string };
  destination: { iata: string; identityKey?: string };
}): string {
  return `${routePointIdentityKey(route.origin)}>${routePointIdentityKey(route.destination)}`;
}

/** Code pair of a directed route (`PEK-PVG`): a label, never an identity. */
export function routeKeyFromCodes(route: {
  origin: { iata: string };
  destination: { iata: string };
}): string {
  return `${route.origin.iata}-${route.destination.iata}`;
}

export function airportSelectionTarget(point: {
  iata: string;
  identityKey?: string;
}): AirportSelectionTarget {
  return {
    kind: "airport",
    code: point.iata,
    ...(point.identityKey ? { identityKey: point.identityKey } : {}),
  };
}

export function routeSelectionTarget(route: {
  origin: { iata: string; identityKey?: string };
  destination: { iata: string; identityKey?: string };
}): RouteSelectionTarget {
  return {
    kind: "route",
    origin: route.origin.iata,
    destination: route.destination.iata,
    ...(route.origin.identityKey
      ? { originIdentityKey: route.origin.identityKey }
      : {}),
    ...(route.destination.identityKey
      ? { destinationIdentityKey: route.destination.identityKey }
      : {}),
  };
}

/** Matches one endpoint: by physical identity when the target has one, else by code. */
export function airportTargetMatches(
  target: { code: string; identityKey?: string },
  point: { iata: string; identityKey?: string },
): boolean {
  return target.identityKey
    ? point.identityKey === target.identityKey
    : point.iata === target.code;
}

export function routeTargetMatches(
  target: Omit<RouteSelectionTarget, "kind">,
  route: {
    origin: { iata: string; identityKey?: string };
    destination: { iata: string; identityKey?: string };
  },
): boolean {
  return (
    airportTargetMatches(
      { code: target.origin, identityKey: target.originIdentityKey },
      route.origin,
    ) &&
    airportTargetMatches(
      { code: target.destination, identityKey: target.destinationIdentityKey },
      route.destination,
    )
  );
}

/** Directed route target of a flight at its flight-date physical endpoints. */
export function flightRouteTarget(flight: KeeprawFlight): RouteSelectionTarget {
  return routeSelectionTarget({
    origin: originIdentity(flight),
    destination: arrivalIdentity(flight),
  });
}

/** Directed physical route key of a flight at its flight-date endpoints. */
export function flightRouteIdentityKey(flight: KeeprawFlight): string {
  return routeIdentityKey({
    origin: originIdentity(flight),
    destination: arrivalIdentity(flight),
  });
}

/** Whether a flight used the selected airport (origin or actual arrival) at its date. */
export function flightMatchesAirportTarget(
  flight: KeeprawFlight,
  target: { code: string; identityKey?: string },
): boolean {
  return (
    airportTargetMatches(target, originIdentity(flight)) ||
    airportTargetMatches(target, arrivalIdentity(flight))
  );
}

export function flightMatchesRouteTarget(
  flight: KeeprawFlight,
  target: Omit<RouteSelectionTarget, "kind">,
): boolean {
  return routeTargetMatches(target, {
    origin: originIdentity(flight),
    destination: arrivalIdentity(flight),
  });
}
