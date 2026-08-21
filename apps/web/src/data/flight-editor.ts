import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  KEEPRAW_FLY_FORMAT,
  KEEPRAW_FLY_FORMAT_VERSION,
} from "@keepraw-fly/schema";
import { airportByIata } from "@keepraw-fly/core";

export interface FlightDraft {
  flightNumber: string;
  airlineIata: string;
  serviceDate: string;
  originIata: string;
  destinationIata: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
}

export function createEmptyDocument(): KeeprawFlyDocument {
  return {
    format: KEEPRAW_FLY_FORMAT,
    formatVersion: KEEPRAW_FLY_FORMAT_VERSION,
    profile: {},
    flights: [],
  };
}

export function createDefaultDraft(today = localDateString(new Date())): FlightDraft {
  return {
    flightNumber: "",
    airlineIata: "",
    serviceDate: today,
    originIata: "",
    destinationIata: "",
    departureTime: "09:00",
    arrivalDate: today,
    arrivalTime: "11:00",
  };
}

export function flightToDraft(flight: KeeprawFlight): FlightDraft {
  const originTimezone = airportByIata.get(flight.origin.iata)?.timezone ?? "UTC";
  const destinationTimezone = airportByIata.get(flight.destination.iata)?.timezone ?? "UTC";
  const departure = localPartsAtAirport(flight.scheduledDeparture, originTimezone);
  const arrival = localPartsAtAirport(flight.scheduledArrival, destinationTimezone);

  return {
    flightNumber: flight.flightNumber,
    airlineIata: flight.airline.iata ?? "",
    serviceDate: flight.serviceDate,
    originIata: flight.origin.iata,
    destinationIata: flight.destination.iata,
    departureTime: departure.time,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
  };
}

export function flightFromDraft(draft: FlightDraft, existing?: KeeprawFlight): KeeprawFlight {
  const origin = airportByIata.get(draft.originIata);
  const destination = airportByIata.get(draft.destinationIata);
  if (!origin || !destination) throw new Error("unknown-airport");

  const scheduledDeparture = zonedDateTimeToIso(
    draft.serviceDate,
    draft.departureTime,
    origin.timezone,
  );
  const scheduledArrival = zonedDateTimeToIso(
    draft.arrivalDate,
    draft.arrivalTime,
    destination.timezone,
  );
  if (Date.parse(scheduledArrival) <= Date.parse(scheduledDeparture)) {
    throw new Error("arrival-before-departure");
  }

  return {
    ...existing,
    id: existing?.id ?? `flight-${crypto.randomUUID()}`,
    flightNumber: draft.flightNumber.trim().toUpperCase(),
    serviceDate: draft.serviceDate,
    airline: { ...existing?.airline, iata: draft.airlineIata },
    origin: { ...existing?.origin, iata: draft.originIata },
    destination: { ...existing?.destination, iata: draft.destinationIata },
    scheduledDeparture,
    scheduledArrival,
  };
}

export function zonedDateTimeToIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    throw new Error("invalid-local-time");
  }

  const wallTime = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let instant = wallTime;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const observed = partsAtInstant(new Date(instant), timezone);
    const observedWallTime = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    instant += wallTime - observedWallTime;
  }

  const offsetMinutes = Math.round((wallTime - instant) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetRemainder = String(absoluteOffset % 60).padStart(2, "0");
  return `${date}T${time}:00${sign}${offsetHours}:${offsetRemainder}`;
}

function localPartsAtAirport(iso: string, timezone: string) {
  const parts = partsAtInstant(new Date(iso), timezone);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

function partsAtInstant(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
