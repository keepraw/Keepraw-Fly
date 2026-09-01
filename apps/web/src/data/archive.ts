import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";

export function flightById(
  document: KeeprawFlyDocument | null,
  flightId: string | null,
): KeeprawFlight | undefined {
  return document && flightId
    ? document.flights.find((flight) => flight.id === flightId)
    : undefined;
}

export function documentWithoutFlight(
  document: KeeprawFlyDocument,
  flightId: string,
): KeeprawFlyDocument {
  return {
    ...document,
    flights: document.flights.filter((flight) => flight.id !== flightId),
  };
}
