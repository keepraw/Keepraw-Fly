import type { KeeprawFlight } from "@keepraw-fly/schema";
import { arrivalDelayMinutes, departureDelayMinutes } from "./calculations";
import { formatTimeAtAirport, type TimeFormat } from "./formatting";
import type { SupportedLocale } from "./reference-data";
import {
  arrivalIdentity,
  originIdentity,
  plannedDestinationIdentity,
} from "./flight-airports";

export interface DisplayTime {
  timestamp: string;
  time: string;
  source: "actual" | "scheduled";
  dayOffset: number;
}

export interface FlightStopTimes {
  primary: DisplayTime;
  scheduled?: DisplayTime;
  delayMinutes: number | null;
}

// Compare the calendar dates written in each airport-local offset datetime.
// Elapsed time and delay still use the original instants, including their zones.
export function localCalendarDayOffset(
  departure: string,
  arrival: string,
): number {
  return Math.round(
    (Date.parse(`${arrival.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${departure.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  );
}

export function delayDirection(minutes: number): "early" | "late" | "onTime" {
  return minutes < 0 ? "early" : minutes > 0 ? "late" : "onTime";
}

export function flightTimeDisplay(
  flight: KeeprawFlight,
  locale: SupportedLocale,
  timeFormat: TimeFormat,
): {
  departure: FlightStopTimes;
  arrival: FlightStopTimes;
  scheduled: { departure: DisplayTime; arrival: DisplayTime };
  overnight: boolean;
} {
  const departureTimestamp =
    flight.actualDeparture ?? flight.scheduledDeparture;
  const arrivalTimestamp = flight.actualArrival ?? flight.scheduledArrival;
  // Flight-date historical zones; null shows the written offset wall time.
  const zones = new Map<string, string | null>([
    [`o:${flight.origin.iata}`, originIdentity(flight).timezone],
    [
      `d:${flight.destination.iata}`,
      plannedDestinationIdentity(flight).timezone,
    ],
  ]);
  if (flight.divertedTo)
    zones.set(`a:${flight.divertedTo.iata}`, arrivalIdentity(flight).timezone);
  const time = (
    timestamp: string,
    endpoint: string,
    source: DisplayTime["source"],
    dayOffset = 0,
  ): DisplayTime => ({
    timestamp,
    source,
    dayOffset,
    time: formatTimeAtAirport(
      timestamp,
      endpoint.slice(2),
      locale,
      timeFormat,
      zones.get(endpoint) ?? null,
    ),
  });
  const differs = (actual: string | undefined, scheduled: string) =>
    actual !== undefined && Date.parse(actual) !== Date.parse(scheduled);
  const scheduledArrivalOffset = localCalendarDayOffset(
    flight.scheduledDeparture,
    flight.scheduledArrival,
  );
  const primaryArrivalOffset = localCalendarDayOffset(
    departureTimestamp,
    arrivalTimestamp,
  );
  const scheduled = {
    departure: time(
      flight.scheduledDeparture,
      `o:${flight.origin.iata}`,
      "scheduled",
    ),
    arrival: time(
      flight.scheduledArrival,
      `d:${flight.destination.iata}`,
      "scheduled",
      scheduledArrivalOffset,
    ),
  };
  return {
    scheduled,
    departure: {
      primary: time(
        departureTimestamp,
        `o:${flight.origin.iata}`,
        flight.actualDeparture ? "actual" : "scheduled",
      ),
      scheduled: differs(flight.actualDeparture, flight.scheduledDeparture)
        ? scheduled.departure
        : undefined,
      delayMinutes: flight.cancelled ? null : departureDelayMinutes(flight),
    },
    arrival: {
      primary: time(
        arrivalTimestamp,
        flight.actualArrival && flight.divertedTo
          ? `a:${flight.divertedTo.iata}`
          : `d:${flight.destination.iata}`,
        flight.actualArrival ? "actual" : "scheduled",
        primaryArrivalOffset,
      ),
      scheduled: differs(flight.actualArrival, flight.scheduledArrival)
        ? scheduled.arrival
        : undefined,
      delayMinutes: flight.cancelled ? null : arrivalDelayMinutes(flight),
    },
    overnight: primaryArrivalOffset > 0,
  };
}
