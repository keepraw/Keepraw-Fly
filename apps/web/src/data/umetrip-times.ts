import { distanceKilometers, type AirportReference } from "@keepraw-fly/core";
import {
  airportTimeFormatter,
  localPartsAtAirport,
  zonedDateTimeToIso,
} from "./flight-editor";

export type UmetripCellValue = string | number | null;

export function umetripDate(value: UmetripCellValue, date1904 = false): string {
  if (typeof value === "number") {
    // Excel's fictitious 1900-02-29 is not a calendar date. Never round away a
    // time hidden inside a date cell or accept serials outside Excel's range.
    if (
      !Number.isInteger(value) ||
      value < (date1904 ? 0 : 1) ||
      value > (date1904 ? 2_957_003 : 2_958_465) ||
      (!date1904 && value === 60)
    )
      throw new Error("invalid-date");
    const epoch = Date.parse(date1904 ? "1904-01-01Z" : "1899-12-31Z");
    const days = value - (!date1904 && value > 60 ? 1 : 0);
    return new Date(epoch + days * 86_400_000).toISOString().slice(0, 10);
  }
  const match =
    /^(\d{4})(?:年(\d{1,2})月(\d{1,2})日|([-/.])(\d{1,2})\4(\d{1,2}))$/.exec(
      (value ?? "").trim(),
    );
  if (!match) throw new Error("invalid-date");
  const date = `${match[1]}-${(match[2] ?? match[5])!.padStart(2, "0")}-${(match[3] ?? match[6])!.padStart(2, "0")}`;
  const instant = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== date
  )
    throw new Error("invalid-date");
  return date;
}

export function umetripClock(value: UmetripCellValue): string {
  if (typeof value === "number") {
    // Fractional days are wall-clock times, not instants in the machine zone.
    const minutes = Math.round(value * 1440);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value >= 1 ||
      minutes >= 1440 ||
      Math.abs(value * 1440 - minutes) > 0.00001
    )
      throw new Error("invalid-time");
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const match = /^(\d{1,2}):(\d{2})(?::00)?$/.exec((value ?? "").trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw new Error("invalid-time");
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

export function inferUmetripTimes(input: {
  serviceDate: string;
  departureTime: string;
  arrivalTime: string;
  arrivalDate?: string;
  origin: AirportReference;
  destination: AirportReference;
}): { departure: string; arrival: string } {
  const { serviceDate, departureTime, arrivalTime, origin, destination } =
    input;
  try {
    airportTimeFormatter(origin.timezone);
    airportTimeFormatter(destination.timezone);
  } catch {
    throw new Error("invalid-timezone");
  }
  const departure = zonedDateTimeToIso(
    serviceDate,
    departureTime,
    origin.timezone,
  );
  const start = Date.parse(departure);
  // Broad scheduled block-time sanity bounds, not a route schedule or a claim
  // about historical airport locations. Coordinates are never saved to flights.
  const distance = distanceKilometers(origin, destination);
  if (!Number.isFinite(distance)) throw new Error("invalid-duration");
  const minimum = Math.max(15, (distance / 1200) * 60 - 30);
  const maximum = Math.min(24 * 60, (distance / 400) * 60 + 180);

  // Observe destination offsets throughout the possible UTC arrival window.
  // This prunes unrelated dates before DST resolution, while retaining both
  // sides of a transition and flagging gaps/overlaps on plausible dates.
  const offsets = new Set<number>();
  for (let minute = minimum; ; minute = Math.min(minute + 180, maximum)) {
    const instant = Math.floor((start + minute * 60_000) / 60_000) * 60_000;
    const parts = localPartsAtAirport(
      new Date(instant).toISOString(),
      destination.timezone,
    );
    offsets.add(Date.parse(`${parts.date}T${parts.time}:00Z`) - instant);
    if (minute === maximum) break;
  }
  const arrivals: string[] = [];
  for (let day = -2; day <= 3; day++) {
    const date = input.arrivalDate ?? shiftUmetripDate(serviceDate, day);
    const wall = Date.parse(`${date}T${arrivalTime}:00Z`);
    const plausible = [...offsets].some((offset) => {
      const duration = (wall - offset - start) / 60_000;
      return duration >= minimum && duration <= maximum;
    });
    if (plausible) {
      const arrival = zonedDateTimeToIso(
        date,
        arrivalTime,
        destination.timezone,
      );
      const duration = (Date.parse(arrival) - start) / 60_000;
      if (duration >= minimum && duration <= maximum) arrivals.push(arrival);
    }
    if (input.arrivalDate) break;
  }
  if (!arrivals.length) throw new Error("invalid-duration");
  if (arrivals.length !== 1) throw new Error("ambiguous-arrival-date");
  return { departure, arrival: arrivals[0]! };
}

function shiftUmetripDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
