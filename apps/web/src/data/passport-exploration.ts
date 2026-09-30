import type { KeeprawFlight } from "@keepraw-fly/schema";
import { searchFlights, sortFlightsNewestFirst } from "@keepraw-fly/core";

export type PassportSelection =
  | { kind: "airport"; code: string }
  | { kind: "airline"; code: string }
  | { kind: "route"; origin: string; destination: string };

export interface PassportViewState {
  year: number | "lifetime";
  query: string;
  selection: PassportSelection | null;
  flightId: string | null;
}

export const initialPassportView: PassportViewState = { year: "lifetime", query: "", selection: null, flightId: null };

export function passportVisibleFlights(flights: KeeprawFlight[], view: PassportViewState): KeeprawFlight[] {
  const period = view.year === "lifetime" ? flights : flights.filter((flight) => flight.serviceDate.startsWith(String(view.year)));
  const selection = view.selection;
  const selected = selection ? period.filter((flight) => matchesSelection(flight, selection)) : period;
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
  const matches = sortFlightsNewestFirst(flights.filter((flight) => matchesSelection(flight, selection)));

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

function matchesSelection(flight: KeeprawFlight, selection: PassportSelection): boolean {
  if (selection.kind === "airport") {
    return flight.origin.iata === selection.code || (flight.divertedTo ?? flight.destination).iata === selection.code;
  }
  if (selection.kind === "airline") return airlineCode(flight) === selection.code;
  return flight.origin.iata === selection.origin && (flight.divertedTo ?? flight.destination).iata === selection.destination;
}
