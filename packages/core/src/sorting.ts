import type { KeeprawFlight } from "@keepraw-fly/schema";
import { flightDistanceKilometers } from "./flight-airports";

export function sortFlightsNewestFirst(
  flights: KeeprawFlight[],
): KeeprawFlight[] {
  return [...flights].sort((a, b) => {
    const dateOrder = b.serviceDate.localeCompare(a.serviceDate);
    // Equal instants compare as zero, preserving the archive's stable order.
    return (
      dateOrder ||
      Date.parse(b.scheduledDeparture) - Date.parse(a.scheduledDeparture)
    );
  });
}

export interface FlightYearGroup {
  year: string;
  flights: KeeprawFlight[];
}

export function groupFlightsByYear(
  flights: KeeprawFlight[],
  order: "newest" | "oldest" = "newest",
): FlightYearGroup[] {
  const groups = new Map<string, KeeprawFlight[]>();
  for (const flight of sortFlights(flights, order)) {
    const year = flight.serviceDate.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), flight]);
  }
  return [...groups].map(([year, groupedFlights]) => ({
    year,
    flights: groupedFlights,
  }));
}

export const FLIGHT_SORT_ORDERS = [
  "newest",
  "oldest",
  "longest",
  "shortest",
] as const;
export type FlightSortOrder = (typeof FLIGHT_SORT_ORDERS)[number];

/**
 * Order flights by date or by great-circle distance. Cancelled flights flew no
 * distance: they and flights whose distance is undetermined come last in both
 * distance orders; ties are newest first.
 */
export function sortFlights(
  flights: KeeprawFlight[],
  order: FlightSortOrder,
): KeeprawFlight[] {
  const newestFirst = sortFlightsNewestFirst(flights);
  if (order === "newest") return newestFirst;
  if (order === "oldest") {
    return [...flights].sort(
      (a, b) =>
        a.serviceDate.localeCompare(b.serviceDate) ||
        Date.parse(a.scheduledDeparture) - Date.parse(b.scheduledDeparture),
    );
  }
  const distances = new Map(
    newestFirst.map((flight) => [
      flight,
      flight.cancelled ? null : flightDistanceKilometers(flight),
    ]),
  );
  const direction = order === "longest" ? -1 : 1;
  return newestFirst.sort((a, b) => {
    const left = distances.get(a) ?? null;
    const right = distances.get(b) ?? null;
    if (left === null || right === null)
      return Number(left === null) - Number(right === null);
    return (left - right) * direction;
  });
}
