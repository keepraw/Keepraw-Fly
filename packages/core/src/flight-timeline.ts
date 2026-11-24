import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  arrivalIdentity,
  isFixedOffset,
  localDateInZone,
  originIdentity,
  plannedDestinationIdentity,
  type FlightEndpointIdentity,
} from "./flight-airports";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** One operation on the shared axis, and its own length. */
export interface ComparisonInterval {
  startMinutes: number;
  endMinutes: number;
  /** Rounded from the elapsed time, as `flightDuration` does. */
  durationMinutes: number;
}

/** Two intervals on one axis, in minutes from the earliest of the four times. */
export interface PlannedActualComparison {
  spanMinutes: number;
  scheduled: ComparisonInterval;
  actual: ComparisonInterval;
  departureDelayMinutes: number;
  arrivalDelayMinutes: number;
  /** Actual minus scheduled duration, each as shown. */
  durationDeltaMinutes: number;
}

/**
 * The scheduled and the actual operation of a flight side by side. `null` when
 * the flight was cancelled or diverted, when either actual time is not
 * recorded, or when a pair of times does not describe a positive duration.
 */
export function plannedActualComparison(
  flight: KeeprawFlight,
): PlannedActualComparison | null {
  if (flight.cancelled || flight.divertedTo) return null;
  if (!flight.actualDeparture || !flight.actualArrival) return null;
  const scheduledStart = Date.parse(flight.scheduledDeparture);
  const scheduledEnd = Date.parse(flight.scheduledArrival);
  const actualStart = Date.parse(flight.actualDeparture);
  const actualEnd = Date.parse(flight.actualArrival);
  const times = [scheduledStart, scheduledEnd, actualStart, actualEnd];
  if (!times.every(Number.isFinite)) return null;
  if (scheduledEnd <= scheduledStart || actualEnd <= actualStart) return null;
  const first = Math.min(scheduledStart, actualStart);
  const minutes = (time: number) => Math.round((time - first) / MINUTE);
  // Each end is rounded for its place on the axis; a duration is rounded from
  // the elapsed time, so it is the one shown elsewhere for the flight.
  const interval = (start: number, end: number): ComparisonInterval => ({
    startMinutes: minutes(start),
    endMinutes: minutes(end),
    durationMinutes: Math.round((end - start) / MINUTE),
  });
  const scheduled = interval(scheduledStart, scheduledEnd);
  const actual = interval(actualStart, actualEnd);
  return {
    spanMinutes: minutes(Math.max(scheduledEnd, actualEnd)),
    scheduled,
    actual,
    departureDelayMinutes: Math.round((actualStart - scheduledStart) / MINUTE),
    arrivalDelayMinutes: Math.round((actualEnd - scheduledEnd) / MINUTE),
    durationDeltaMinutes: actual.durationMinutes - scheduled.durationMinutes,
  };
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes a zone (IANA or `±HH:MM`) is ahead of UTC at an instant. */
export function zoneOffsetMinutes(
  instant: number,
  zone: string,
): number | null {
  if (!Number.isFinite(instant)) return null;
  if (isFixedOffset(zone))
    return (
      (zone.startsWith("-") ? -1 : 1) *
      (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)))
    );
  try {
    let formatter = offsetFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      if (offsetFormatters.size > 256) offsetFormatters.clear();
      offsetFormatters.set(zone, formatter);
    }
    const parts = formatter.formatToParts(instant);
    const value = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value);
    const wall = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const offset = Math.round((wall - instant) / MINUTE);
    return Number.isFinite(offset) ? offset : null;
  } catch {
    return null;
  }
}

/** One end of the flight: the clock of its airport across the whole flight. */
export interface TimelineClock {
  iata: string;
  /** Flight-date zone of the airport (IANA or `±HH:MM`). */
  timezone: string;
  /** Local calendar days after the departure date at the origin. */
  departureDayOffset: number;
  arrivalDayOffset: number;
  /** Where this clock passes midnight, as fractions (0–1) of the flight. */
  midnights: number[];
}

export interface FlightTimeline {
  /** The departure and arrival shown for the flight: actual when recorded. */
  departure: string;
  arrival: string;
  durationMinutes: number;
  origin: TimelineClock;
  destination: TimelineClock;
  /**
   * Where the great-circle route meets the 180° meridian, as a fraction (0–1)
   * of the route; `null` when it does not or an airport position is unknown.
   * It is a position on the route, not a recorded time.
   */
  dateLineFraction: number | null;
}

function dayOffset(from: string, to: string): number | null {
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY;
  return Number.isFinite(days) ? Math.round(days) : null;
}

function midnights(start: number, end: number, zone: string): number[] {
  const result: number[] = [];
  let cursor = start;
  // A flight passes at most a few midnights; the bound guards odd records.
  for (let step = 0; step < 4; step += 1) {
    const offset = zoneOffsetMinutes(cursor, zone);
    if (offset === null) break;
    const wall = cursor + offset * MINUTE;
    const nextWall = (Math.floor(wall / DAY) + 1) * DAY;
    let instant = nextWall - offset * MINUTE;
    // The offset may change before that midnight (daylight saving time).
    const offsetThen = zoneOffsetMinutes(instant, zone);
    if (offsetThen !== null) instant = nextWall - offsetThen * MINUTE;
    if (instant >= end || instant <= cursor) break;
    result.push((instant - start) / (end - start));
    cursor = instant;
  }
  return result;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Fraction of the great-circle route from `from` to `to` at which it meets the
 * 180° meridian, or `null` when the shorter way between them does not.
 */
export function antimeridianCrossing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number | null {
  const values = [from.latitude, from.longitude, to.latitude, to.longitude];
  if (!values.every(Number.isFinite)) return null;
  if (Math.abs(to.longitude - from.longitude) <= 180) return null;
  const [lat1, lon1, lat2, lon2] = values.map(radians) as [
    number,
    number,
    number,
    number,
  ];
  const start = [
    Math.cos(lat1) * Math.cos(lon1),
    Math.cos(lat1) * Math.sin(lon1),
    Math.sin(lat1),
  ] as const;
  const end = [
    Math.cos(lat2) * Math.cos(lon2),
    Math.cos(lat2) * Math.sin(lon2),
    Math.sin(lat2),
  ] as const;
  const angle = Math.acos(
    Math.min(
      1,
      Math.max(-1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]),
    ),
  );
  if (!(angle > 0) || Math.abs(angle - Math.PI) < 1e-9) return null;
  // The meridian is where the y coordinate of the route changes sign.
  const y = (fraction: number) =>
    (Math.sin((1 - fraction) * angle) * start[1] +
      Math.sin(fraction * angle) * end[1]) /
    Math.sin(angle);
  let low = 0;
  let high = 1;
  if (y(low) === 0) return 0;
  if (y(high) === 0) return 1;
  if (Math.sign(y(low)) === Math.sign(y(high))) return null;
  for (let step = 0; step < 40; step += 1) {
    const middle = (low + high) / 2;
    if (Math.sign(y(middle)) === Math.sign(y(low))) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function clock(
  identity: FlightEndpointIdentity,
  iata: string,
  start: number,
  end: number,
  departureDate: string,
): TimelineClock | null {
  const timezone = identity.timezone;
  if (!timezone) return null;
  const startDate = localDateInZone(new Date(start).toISOString(), timezone);
  const endDate = localDateInZone(new Date(end).toISOString(), timezone);
  if (!startDate || !endDate) return null;
  const departureDayOffset = dayOffset(departureDate, startDate);
  const arrivalDayOffset = dayOffset(departureDate, endDate);
  if (departureDayOffset === null || arrivalDayOffset === null) return null;
  return {
    iata,
    timezone,
    departureDayOffset,
    arrivalDayOffset,
    midnights: midnights(start, end, timezone),
  };
}

/**
 * The flight on the clocks of both airports. `null` when the flight was
 * cancelled, when a time or a flight-date zone is unknown, when the times do
 * not describe a positive duration, or when both airports keep the same clock
 * for the whole flight, so there is nothing to compare.
 */
export function flightTimeline(flight: KeeprawFlight): FlightTimeline | null {
  if (flight.cancelled) return null;
  const departure = flight.actualDeparture ?? flight.scheduledDeparture;
  const arrival = flight.actualArrival ?? flight.scheduledArrival;
  const start = Date.parse(departure);
  const end = Date.parse(arrival);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return null;
  const originEnd = originIdentity(flight);
  const arrivalEnd = flight.actualArrival
    ? arrivalIdentity(flight)
    : plannedDestinationIdentity(flight);
  if (!originEnd.timezone || !arrivalEnd.timezone) return null;
  const departureDate = localDateInZone(departure, originEnd.timezone);
  if (!departureDate) return null;
  const origin = clock(
    originEnd,
    flight.origin.iata,
    start,
    end,
    departureDate,
  );
  const destination = clock(
    arrivalEnd,
    flight.actualArrival && flight.divertedTo
      ? flight.divertedTo.iata
      : flight.destination.iata,
    start,
    end,
    departureDate,
  );
  if (!origin || !destination) return null;
  const sameClock = [start, end].every(
    (instant) =>
      zoneOffsetMinutes(instant, origin.timezone) ===
      zoneOffsetMinutes(instant, destination.timezone),
  );
  if (sameClock) return null;
  return {
    departure,
    arrival,
    durationMinutes: Math.round((end - start) / MINUTE),
    origin,
    destination,
    dateLineFraction:
      originEnd.confirmed &&
      arrivalEnd.confirmed &&
      originEnd.point &&
      arrivalEnd.point
        ? antimeridianCrossing(originEnd.point, arrivalEnd.point)
        : null,
  };
}
