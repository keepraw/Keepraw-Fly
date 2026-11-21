import type { KeeprawFlight } from "@keepraw-fly/schema";

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
): FlightYearGroup[] {
  const groups = new Map<string, KeeprawFlight[]>();
  for (const flight of sortFlightsNewestFirst(flights)) {
    const year = flight.serviceDate.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), flight]);
  }
  return [...groups].map(([year, groupedFlights]) => ({
    year,
    flights: groupedFlights,
  }));
}
