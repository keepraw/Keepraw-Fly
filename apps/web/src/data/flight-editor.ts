import type {
  ExtensionMap,
  JsonValue,
  KeeprawFlight,
  KeeprawFlyDocument,
} from "@keepraw-fly/schema";
import {
  KEEPRAW_FLY_FORMAT,
  KEEPRAW_FLY_FORMAT_VERSION,
} from "@keepraw-fly/schema";
import { aircraftFacts, airportByIata, baggageFacts, seatFacts } from "@keepraw-fly/core";

export type BaggageStatus = "" | "not-checked" | "checked";

export interface FlightDraft {
  airlineCode: string;
  serviceNumber: string;
  serviceDate: string;
  originIata: string;
  destinationIata: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  actualDepartureDate: string;
  actualDepartureTime: string;
  actualArrivalDate: string;
  actualArrivalTime: string;
  originTerminal: string;
  originGate: string;
  destinationTerminal: string;
  aircraftType: string;
  aircraftRegistration: string;
  seat: string;
  cabin: string;
  bookingClass: string;
  baggageStatus: BaggageStatus;
  baggageCarousel: string;
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
    airlineCode: "",
    serviceNumber: "",
    serviceDate: today,
    originIata: "",
    destinationIata: "",
    departureTime: "09:00",
    arrivalDate: today,
    arrivalTime: "11:00",
    actualDepartureDate: "",
    actualDepartureTime: "",
    actualArrivalDate: "",
    actualArrivalTime: "",
    originTerminal: "",
    originGate: "",
    destinationTerminal: "",
    aircraftType: "",
    aircraftRegistration: "",
    seat: "",
    cabin: "",
    bookingClass: "",
    baggageStatus: "",
    baggageCarousel: "",
  };
}

export function flightToDraft(flight: KeeprawFlight): FlightDraft {
  const originTimezone = airportByIata.get(flight.origin.iata)?.timezone ?? "UTC";
  const destinationTimezone = airportByIata.get(flight.destination.iata)?.timezone ?? "UTC";
  const departure = localPartsAtAirport(flight.scheduledDeparture, originTimezone);
  const arrival = localPartsAtAirport(flight.scheduledArrival, destinationTimezone);
  const actualDeparture = flight.actualDeparture
    ? localPartsAtAirport(flight.actualDeparture, originTimezone)
    : null;
  const actualArrival = flight.actualArrival
    ? localPartsAtAirport(flight.actualArrival, destinationTimezone)
    : null;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const parsedIdentity = splitFlightNumberInput(flight.flightNumber);
  const referencedAirlineCode = flight.airline.iata ?? flight.airline.icao ?? "";

  return {
    airlineCode: parsedIdentity?.airlineCode ?? referencedAirlineCode,
    serviceNumber: parsedIdentity?.serviceNumber ?? flight.flightNumber.trim().toUpperCase(),
    serviceDate: flight.serviceDate,
    originIata: flight.origin.iata,
    destinationIata: flight.destination.iata,
    departureTime: departure.time,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
    actualDepartureDate: actualDeparture?.date ?? "",
    actualDepartureTime: actualDeparture?.time ?? "",
    actualArrivalDate: actualArrival?.date ?? "",
    actualArrivalTime: actualArrival?.time ?? "",
    originTerminal: flight.origin.terminal ?? "",
    originGate: flight.origin.gate ?? "",
    destinationTerminal: flight.destination.terminal ?? "",
    aircraftType: aircraft?.type ?? "",
    aircraftRegistration: aircraft?.registration ?? "",
    seat: seat?.seat ?? "",
    cabin: seat?.cabin ?? "",
    bookingClass: seat?.bookingClass ?? "",
    baggageStatus: baggage?.checkedBaggage === true
      ? "checked"
      : baggage?.checkedBaggage === false
        ? "not-checked"
        : "",
    baggageCarousel: baggage?.carousel ?? "",
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

  const actualDeparture = optionalZonedDateTime(
    draft.actualDepartureDate,
    draft.actualDepartureTime,
    origin.timezone,
  );
  const actualArrival = optionalZonedDateTime(
    draft.actualArrivalDate,
    draft.actualArrivalTime,
    destination.timezone,
  );
  if (actualDeparture && actualArrival && Date.parse(actualArrival) <= Date.parse(actualDeparture)) {
    throw new Error("actual-arrival-before-departure");
  }
  const bookingClass = draft.bookingClass.trim().toUpperCase();
  if (bookingClass && !/^[A-Z]$/.test(bookingClass)) {
    throw new Error("invalid-booking-class");
  }

  const extensions = updateKnownExtensions(existing?.extensions, draft, bookingClass);
  const originEndpoint = endpointWithOptionalFacts(
    existing?.origin,
    draft.originIata,
    draft.originTerminal,
    draft.originGate,
  );
  const destinationEndpoint = endpointWithOptionalTerminal(
    existing?.destination,
    draft.destinationIata,
    draft.destinationTerminal,
  );
  const identity = normalizeFlightIdentity(draft.airlineCode, draft.serviceNumber);

  const nextFlight: KeeprawFlight = {
    ...existing,
    id: existing?.id ?? `flight-${crypto.randomUUID()}`,
    flightNumber: `${identity.airlineCode}${identity.serviceNumber}`,
    serviceDate: draft.serviceDate,
    airline: airlineReference(existing?.airline, identity.airlineCode),
    origin: originEndpoint,
    destination: destinationEndpoint,
    scheduledDeparture,
    scheduledArrival,
  };
  if (actualDeparture) nextFlight.actualDeparture = actualDeparture;
  else delete nextFlight.actualDeparture;
  if (actualArrival) nextFlight.actualArrival = actualArrival;
  else delete nextFlight.actualArrival;
  if (extensions) nextFlight.extensions = extensions;
  else delete nextFlight.extensions;
  return nextFlight;
}

export interface FlightIdentity {
  airlineCode: string;
  serviceNumber: string;
}

export function splitFlightNumberInput(value: string): FlightIdentity | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^([A-Z][A-Z0-9]|[0-9][A-Z]|[A-Z]{3})-?(\d{1,4}[A-Z]?)$/);
  return match
    ? { airlineCode: match[1]!, serviceNumber: match[2]! }
    : null;
}

function normalizeFlightIdentity(airlineCode: string, serviceNumber: string): FlightIdentity {
  const pastedIdentity = splitFlightNumberInput(serviceNumber);
  const normalizedAirlineCode = pastedIdentity?.airlineCode
    ?? airlineCode.trim().toUpperCase();
  const normalizedServiceNumber = pastedIdentity?.serviceNumber
    ?? serviceNumber.trim().toUpperCase().replace(/\s+/g, "");

  if (!/^([A-Z][A-Z0-9]|[0-9][A-Z]|[A-Z]{3})$/.test(normalizedAirlineCode)) {
    throw new Error("invalid-airline-code");
  }
  if (!/^\d{1,4}[A-Z]?$/.test(normalizedServiceNumber)) {
    throw new Error("invalid-service-number");
  }
  return {
    airlineCode: normalizedAirlineCode,
    serviceNumber: normalizedServiceNumber,
  };
}

function airlineReference(
  existing: KeeprawFlight["airline"] | undefined,
  code: string,
): KeeprawFlight["airline"] {
  const { iata: _iata, icao: _icao, ...preserved } = existing ?? {};
  return code.length === 2
    ? { ...preserved, iata: code }
    : { ...preserved, icao: code };
}

function optionalZonedDateTime(date: string, time: string, timezone: string): string | undefined {
  if (!date && !time) return undefined;
  if (!date || !time) throw new Error("incomplete-actual-time");
  return zonedDateTimeToIso(date, time, timezone);
}

function endpointWithOptionalFacts(
  existing: KeeprawFlight["origin"] | undefined,
  iata: string,
  terminal: string,
  gate: string,
): KeeprawFlight["origin"] {
  const { terminal: _terminal, gate: _gate, ...preserved } = existing ?? { iata };
  return {
    ...preserved,
    iata,
    ...(terminal.trim() ? { terminal: terminal.trim() } : {}),
    ...(gate.trim() ? { gate: gate.trim() } : {}),
  };
}

function endpointWithOptionalTerminal(
  existing: KeeprawFlight["destination"] | undefined,
  iata: string,
  terminal: string,
): KeeprawFlight["destination"] {
  const sameAirport = existing?.iata === iata ? existing : { iata };
  const { terminal: _terminal, ...preserved } = sameAirport;
  return {
    ...preserved,
    iata,
    ...(terminal.trim() ? { terminal: terminal.trim() } : {}),
  };
}

function updateKnownExtensions(
  existing: ExtensionMap | undefined,
  draft: FlightDraft,
  bookingClass: string,
): ExtensionMap | undefined {
  const extensions: ExtensionMap = structuredClone(existing ?? {});
  updateExtensionObject(extensions, "keepraw-fly.aircraft", {
    type: draft.aircraftType.trim(),
    registration: draft.aircraftRegistration.trim(),
  });
  updateExtensionObject(extensions, "keepraw-fly.seat", {
    seat: draft.seat.trim(),
    cabin: draft.cabin.trim(),
    bookingClass,
  });
  updateExtensionObject(extensions, "keepraw-fly.baggage", {
    checkedBaggage: draft.baggageStatus === "" ? undefined : draft.baggageStatus === "checked",
    carousel: draft.baggageStatus === "checked" ? draft.baggageCarousel.trim() : "",
  });
  return Object.keys(extensions).length ? extensions : undefined;
}

function updateExtensionObject(
  extensions: ExtensionMap,
  key: string,
  values: Record<string, JsonValue | undefined>,
) {
  const current = extensions[key];
  const object: Record<string, JsonValue> = current && typeof current === "object" && !Array.isArray(current)
    ? { ...current }
    : {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value === "") delete object[field];
    else object[field] = value;
  }
  if (Object.keys(object).length) extensions[key] = object;
  else delete extensions[key];
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
