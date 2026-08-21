import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airportByIata } from "./reference-data";

export interface RoutePoint {
  iata: string;
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  origin: RoutePoint;
  destination: RoutePoint;
  flightCount: number;
}

export function buildRouteSegments(flights: KeeprawFlight[]): RouteSegment[] {
  const counts = new Map<string, number>();
  for (const flight of flights) {
    const key = `${flight.origin.iata}-${flight.destination.iata}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts]
    .map(([key, flightCount]) => {
      const [originIata, destinationIata] = key.split("-");
      const origin = originIata ? airportByIata.get(originIata) : undefined;
      const destination = destinationIata
        ? airportByIata.get(destinationIata)
        : undefined;
      if (!origin || !destination) return null;
      return {
        origin: {
          iata: origin.iata,
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        destination: {
          iata: destination.iata,
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        flightCount,
      };
    })
    .filter((route): route is RouteSegment => route !== null);
}

