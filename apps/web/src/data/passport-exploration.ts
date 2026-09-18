import type { KeeprawFlight } from "@keepraw-fly/schema";

export type PassportSelection =
  | { kind: "airport"; code: string }
  | { kind: "airline"; code: string }
  | { kind: "route"; origin: string; destination: string };

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
  const matches = flights
    .filter((flight) => matchesSelection(flight, selection))
    .sort((left, right) => right.scheduledDeparture.localeCompare(left.scheduledDeparture));

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
    return flight.origin.iata === selection.code || flight.destination.iata === selection.code;
  }
  if (selection.kind === "airline") return airlineCode(flight) === selection.code;
  return flight.origin.iata === selection.origin && flight.destination.iata === selection.destination;
}
