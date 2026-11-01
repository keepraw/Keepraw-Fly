import type { KeeprawFlight } from "@keepraw-fly/schema";
import { arrivalDelayMinutes } from "./calculations";
import { arrivalIdentity, originIdentity } from "./flight-airports";
import type { RankedAirport } from "./statistics";

export interface AnnualArrivalDelay {
  year: number;
  minutes: number | null;
  recordedArrivals: number;
}

/** Uses the same filtered flights and arrival-delay semantics as the core KPIs. */
export function calculatePassportHighlights(flights: KeeprawFlight[]): {
  annualArrivalDelays: AnnualArrivalDelay[];
  mostVisitedAirports: RankedAirport[];
} {
  const years = new Map<number, AnnualArrivalDelay>();
  const airports = new Map<string, number>();
  const identities = new Map<string, RankedAirport["identity"]>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    // Physical flight-date airports only; unresolved codes are not merged in.
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (!identity.confirmed) continue;
      airports.set(
        identity.identityKey,
        (airports.get(identity.identityKey) ?? 0) + 1,
      );
      if (!identities.has(identity.identityKey))
        identities.set(identity.identityKey, identity);
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
      .map(([identityKey, count]) => {
        const identity = identities.get(identityKey)!;
        return { code: identity.iata, identityKey, count, identity };
      })
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.code.localeCompare(b.code) ||
          a.identityKey.localeCompare(b.identityKey),
      )
      .slice(0, 4),
  };
}
