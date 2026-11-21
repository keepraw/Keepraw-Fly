import type { KeeprawFlight } from "@keepraw-fly/schema";
import { arrivalDelayMinutes, departureDelayMinutes } from "./calculations";
import { formatTimeAtAirport, type TimeFormat } from "./formatting";
import type { SupportedLocale } from "./reference-data";
import {
  arrivalIdentity,
  localDateInZone,
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

/** Compare displayed calendar dates; with no zone, use the written offset date. */
export function localCalendarDayOffset(
  departure: string,
  arrival: string,
  departureZone?: string | null,
  arrivalZone?: string | null,
): number {
  if (
    !Number.isFinite(Date.parse(departure)) ||
    !Number.isFinite(Date.parse(arrival))
  )
    return 0;
  const calendarDay = (timestamp: string, zone?: string | null) => {
    const date =
      (zone ? localDateInZone(timestamp, zone) : null) ??
      timestamp.slice(0, 10);
    return Date.parse(`${date}T00:00:00Z`);
  };
  const days =
    (calendarDay(arrival, arrivalZone) -
      calendarDay(departure, departureZone)) /
    86_400_000;
  return Number.isFinite(days) ? days : 0;
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
  const {
    actualDeparture,
    actualArrival,
    scheduledDeparture,
    scheduledArrival,
    origin,
    destination,
    divertedTo,
  } = flight;
  const departureTimestamp = actualDeparture ?? scheduledDeparture;
  const arrivalTimestamp = actualArrival ?? scheduledArrival;
  // Flight-date historical zones; null shows the written offset wall time.
  const originZone = originIdentity(flight).timezone;
  const plannedZone = plannedDestinationIdentity(flight).timezone;
  const arrivalZone = actualArrival
    ? arrivalIdentity(flight).timezone
    : plannedZone;
  const time = (
    timestamp: string,
    iata: string,
    zone: string | null,
    source: DisplayTime["source"],
    dayOffset = 0,
  ): DisplayTime => ({
    timestamp,
    source,
    dayOffset,
    time: formatTimeAtAirport(timestamp, iata, locale, timeFormat, zone),
  });
  const differs = (actual: string | undefined, scheduled: string) =>
    actual !== undefined && Date.parse(actual) !== Date.parse(scheduled);
  const scheduledArrivalOffset = localCalendarDayOffset(
    scheduledDeparture,
    scheduledArrival,
    originZone,
    plannedZone,
  );
  const primaryArrivalOffset = localCalendarDayOffset(
    departureTimestamp,
    arrivalTimestamp,
    originZone,
    arrivalZone,
  );
  const scheduled = {
    departure: time(scheduledDeparture, origin.iata, originZone, "scheduled"),
    arrival: time(
      scheduledArrival,
      destination.iata,
      plannedZone,
      "scheduled",
      scheduledArrivalOffset,
    ),
  };
  return {
    scheduled,
    departure: {
      primary: time(
        departureTimestamp,
        origin.iata,
        originZone,
        actualDeparture ? "actual" : "scheduled",
      ),
      scheduled: differs(actualDeparture, scheduledDeparture)
        ? scheduled.departure
        : undefined,
      delayMinutes: flight.cancelled ? null : departureDelayMinutes(flight),
    },
    arrival: {
      primary: time(
        arrivalTimestamp,
        actualArrival && divertedTo ? divertedTo.iata : destination.iata,
        arrivalZone,
        actualArrival ? "actual" : "scheduled",
        primaryArrivalOffset,
      ),
      scheduled: differs(actualArrival, scheduledArrival)
        ? scheduled.arrival
        : undefined,
      delayMinutes: flight.cancelled ? null : arrivalDelayMinutes(flight),
    },
    overnight: primaryArrivalOffset > 0,
  };
}
