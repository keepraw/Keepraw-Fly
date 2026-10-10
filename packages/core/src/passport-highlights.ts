import type { KeeprawFlight } from "@keepraw-fly/schema";
import { arrivalDelayMinutes } from "./calculations";
import type { RankedCode } from "./statistics";

export interface AnnualArrivalDelay {
  year: number;
  minutes: number | null;
  recordedArrivals: number;
}

/** Uses the same filtered flights and arrival-delay semantics as the core KPIs. */
export function calculatePassportHighlights(flights: KeeprawFlight[]): {
  annualArrivalDelays: AnnualArrivalDelay[];
  mostVisitedAirports: RankedCode[];
} {
  const years = new Map<number, AnnualArrivalDelay>();
  const airports = new Map<string, number>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    for (const code of [
      flight.origin.iata,
      (flight.divertedTo ?? flight.destination).iata,
    ]) {
      airports.set(code, (airports.get(code) ?? 0) + 1);
    }
    const year = Number(flight.serviceDate.slice(0, 4));
    const annual = years.get(year) ?? {
      year,
      minutes: null,
      recordedArrivals: 0,
    };
    const delay = arrivalDelayMinutes(flight);
    if (delay !== null) {
      annual.minutes = (annual.minutes ?? 0) + Math.max(0, delay);
      annual.recordedArrivals += 1;
    }
    years.set(year, annual);
  }
  return {
    annualArrivalDelays: [...years.values()].sort((a, b) => a.year - b.year),
    mostVisitedAirports: [...airports]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 4),
  };
}
