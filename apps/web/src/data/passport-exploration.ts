import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  flightMatchesAirportTarget,
  flightMatchesRouteTarget,
  searchFlights,
  sortFlightsNewestFirst,
  type AirportSelectionTarget,
  type RouteSelectionTarget,
} from "@keepraw-fly/core";

/**
 * Airports and routes are selected by flight-date physical identity
 * (`identityKey`), so two airports that shared one IATA code stay apart. The
 * codes remain for display; a transient selection without identity keys
 * (older state) still matches by code.
 */
export type PassportSelection =
  | AirportSelectionTarget
  | { kind: "airline"; code: string }
  | RouteSelectionTarget;

export interface PassportViewState {
  year: number | "lifetime";
  query: string;
  selection: PassportSelection | null;
  // Explicit list selection from map interactions, independent of detail navigation.
  flightId: string | null;
  scrollFlightId: string | null;
}

export const initialPassportView: PassportViewState = {
  year: "lifetime",
  query: "",
  selection: null,
  flightId: null,
  scrollFlightId: null,
};

export function passportVisibleFlights(
  flights: KeeprawFlight[],
  view: PassportViewState,
): KeeprawFlight[] {
  const period =
    view.year === "lifetime"
      ? flights
      : flights.filter((flight) =>
          flight.serviceDate.startsWith(String(view.year)),
        );
  const selection = view.selection;
  const selected = selection
    ? period.filter((flight) => matchesSelection(flight, selection))
    : period;
  return sortFlightsNewestFirst(searchFlights(selected, view.query));
}

export interface PassportExploration {
  selection: PassportSelection;
  flights: KeeprawFlight[];
  firstServiceDate: string;
  lastServiceDate: string;
}

export function explorePassportFlights(
  flights: KeeprawFlight[],
  selection: PassportSelection,
): PassportExploration | undefined {
  const matches = sortFlightsNewestFirst(
    flights.filter((flight) => matchesSelection(flight, selection)),
  );

  if (!matches.length) return undefined;

  const serviceDates = matches.map((flight) => flight.serviceDate).sort();
  return {
    selection,
    flights: matches,
    firstServiceDate: serviceDates[0]!,
    lastServiceDate: serviceDates[serviceDates.length - 1]!,
  };
}

export function airlineCode(flight: KeeprawFlight): string {
  return flight.airline.iata ?? flight.airline.icao ?? "";
}

export function matchesSelection(
  flight: KeeprawFlight,
  selection: PassportSelection,
): boolean {
  if (selection.kind === "airport")
    return flightMatchesAirportTarget(flight, selection);
  if (selection.kind === "airline")
    return airlineCode(flight) === selection.code;
  return flightMatchesRouteTarget(flight, selection);
}

/** Same target: by physical identity when both carry one, else by code. */
export function sameSelection(
  a: PassportSelection | null,
  b: PassportSelection,
): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "airline" && b.kind === "airline") return a.code === b.code;
  if (a.kind === "airport" && b.kind === "airport")
    return a.identityKey && b.identityKey
      ? a.identityKey === b.identityKey
      : a.code === b.code;
  if (a.kind === "route" && b.kind === "route")
    return a.originIdentityKey &&
      a.destinationIdentityKey &&
      b.originIdentityKey &&
      b.destinationIdentityKey
      ? a.originIdentityKey === b.originIdentityKey &&
          a.destinationIdentityKey === b.destinationIdentityKey
      : a.origin === b.origin && a.destination === b.destination;
  return false;
}
