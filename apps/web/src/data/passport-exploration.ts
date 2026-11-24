import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  flightMatchesAirportTarget,
  flightMatchesRouteTarget,
  flightAircraftType,
  flightAirlineCode,
  searchFlights,
  sortFlights,
  sortFlightsNewestFirst,
  type AirportSelectionTarget,
  type FlightSortOrder,
  type RouteSelectionTarget,
} from "@keepraw-fly/core";

/**
 * Airports and routes are selected by flight-date physical identity
 * (`identityKey`), so two airports that shared one IATA code stay apart. The
 * codes remain for display; a transient selection without identity keys
 * (older state) still matches by code.
 */
export type PassportSelection = AirportSelectionTarget | RouteSelectionTarget;

export interface PassportViewState {
  year: number | "lifetime";
  query: string;
  selection: PassportSelection | null;
  /** Airline code (IATA, else ICAO) the flights are narrowed to. */
  airline: string | null;
  /** Recorded aircraft type the flights are narrowed to. */
  aircraft: string | null;
  sort: FlightSortOrder;
  // Explicit list selection from map interactions, independent of detail navigation.
  flightId: string | null;
  scrollFlightId: string | null;
}

export const initialPassportView: PassportViewState = {
  year: "lifetime",
  query: "",
  selection: null,
  airline: null,
  aircraft: null,
  sort: "newest",
  flightId: null,
  scrollFlightId: null,
};

/** The flights of the year scope, before any filter, selection or search. */
export function passportScopeFlights(
  flights: KeeprawFlight[],
  year: PassportViewState["year"],
): KeeprawFlight[] {
  return year === "lifetime"
    ? flights
    : flights.filter((flight) => flight.serviceDate.startsWith(String(year)));
}

export function passportVisibleFlights(
  flights: KeeprawFlight[],
  view: PassportViewState,
): KeeprawFlight[] {
  const { selection, airline, aircraft } = view;
  const selected = passportScopeFlights(flights, view.year).filter(
    (flight) =>
      (!selection || matchesSelection(flight, selection)) &&
      (!airline || flightAirlineCode(flight) === airline) &&
      (!aircraft || flightAircraftType(flight) === aircraft),
  );
  return sortFlights(searchFlights(selected, view.query), view.sort);
}

/** Whether anything narrows the year scope. */
export function hasPassportFilters(view: PassportViewState): boolean {
  return Boolean(view.selection || view.airline || view.aircraft || view.query);
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

export function matchesSelection(
  flight: KeeprawFlight,
  selection: PassportSelection,
): boolean {
  if (selection.kind === "airport")
    return flightMatchesAirportTarget(flight, selection);
  return flightMatchesRouteTarget(flight, selection);
}

/** Same target: by physical identity when both carry one, else by code. */
export function sameSelection(
  a: PassportSelection | null,
  b: PassportSelection,
): boolean {
  if (!a || a.kind !== b.kind) return false;
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
