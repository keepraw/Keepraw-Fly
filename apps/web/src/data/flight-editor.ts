import type { AirportEndpoint, ExtensionMap, JsonValue, KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { KEEPRAW_FLY_FORMAT, KEEPRAW_FLY_FORMAT_VERSION } from "@keepraw-fly/schema";
import {
  aircraftFacts, airportByIata, baggageFacts,
  normalizeTicketNumber, resolveAirline, seatFacts, ticketFacts,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

export interface FlightDraft {
  flightNumber: string; serviceDate: string; originIata: string; destinationIata: string;
  departureTime: string; arrivalDate: string; arrivalTime: string;
  actualDepartureDate: string; actualDepartureTime: string; actualArrivalDate: string; actualArrivalTime: string;
  originTerminal: string; originGate: string; destinationTerminal: string; destinationGate: string;
  aircraftType: string; aircraftRegistration: string; seat: string; cabin: string; bookingClass: string;
  baggageCarousel: string; ticketNumber: string; bookingReference: string;
  frequentFlyerMembershipId: string; frequentFlyerTierAtFlight: string;
  cancelled?: boolean; divertedToIata?: string;
}

export function createEmptyDocument(): KeeprawFlyDocument {
  return { format: KEEPRAW_FLY_FORMAT, formatVersion: KEEPRAW_FLY_FORMAT_VERSION, profile: {}, flights: [] };
}

export function createDefaultDraft(today = localDateString(new Date())): FlightDraft {
  return {
    flightNumber: "", serviceDate: today, originIata: "", destinationIata: "",
    departureTime: "09:00", arrivalDate: today, arrivalTime: "11:00",
    actualDepartureDate: "", actualDepartureTime: "", actualArrivalDate: "", actualArrivalTime: "",
    originTerminal: "", originGate: "", destinationTerminal: "", destinationGate: "", aircraftType: "",
    aircraftRegistration: "", seat: "", cabin: "", bookingClass: "",
    baggageCarousel: "", ticketNumber: "", bookingReference: "",
    frequentFlyerMembershipId: "", frequentFlyerTierAtFlight: "",
    cancelled: false, divertedToIata: "",
  };
}

export function flightToDraft(
  flight: KeeprawFlight,
  options: { duplicate?: boolean; memberships?: readonly FrequentFlyerMembership[] } = {},
): FlightDraft {
  const originTimezone = airportByIata.get(flight.origin.iata)?.timezone ?? "UTC";
  const destinationTimezone = airportByIata.get(flight.destination.iata)?.timezone ?? "UTC";
  const actualArrivalTimezone = airportByIata.get(flight.divertedTo?.iata ?? flight.destination.iata)?.timezone ?? "UTC";
  const departure = localPartsAtAirport(flight.scheduledDeparture, originTimezone);
  const arrival = localPartsAtAirport(flight.scheduledArrival, destinationTimezone);
  const actualDeparture = flight.actualDeparture ? localPartsAtAirport(flight.actualDeparture, originTimezone) : null;
  const actualArrival = flight.actualArrival ? localPartsAtAirport(flight.actualArrival, actualArrivalTimezone) : null;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const ticket = ticketFacts(flight);
  const reference = flight.frequentFlyer;
  const currentMembership = options.memberships?.find((membership) => membership.id === reference?.membershipId);

  return {
    flightNumber: normalizeFlightNumberInput(flight.flightNumber), serviceDate: flight.serviceDate,
    originIata: flight.origin.iata, destinationIata: flight.destination.iata,
    departureTime: departure.time, arrivalDate: arrival.date, arrivalTime: arrival.time,
    actualDepartureDate: options.duplicate ? "" : actualDeparture?.date ?? "",
    actualDepartureTime: options.duplicate ? "" : actualDeparture?.time ?? "",
    actualArrivalDate: options.duplicate ? "" : actualArrival?.date ?? "",
    actualArrivalTime: options.duplicate ? "" : actualArrival?.time ?? "",
    originTerminal: flight.origin.terminal ?? "", originGate: options.duplicate ? "" : flight.origin.gate ?? "",
    destinationTerminal: flight.destination.terminal ?? "", destinationGate: options.duplicate ? "" : flight.destination.gate ?? "", aircraftType: aircraft?.type ?? "",
    aircraftRegistration: options.duplicate ? "" : aircraft?.registration ?? "",
    seat: options.duplicate ? "" : seat?.seat ?? "", cabin: seat?.cabin ?? "", bookingClass: seat?.bookingClass ?? "",
    baggageCarousel: options.duplicate ? "" : baggage?.carousel ?? "",
    ticketNumber: options.duplicate ? "" : ticket?.number ?? "",
    bookingReference: options.duplicate ? "" : flight.bookingReference ?? "",
    frequentFlyerMembershipId: reference?.membershipId ?? "",
    frequentFlyerTierAtFlight: options.duplicate
      ? currentMembership?.tier ?? ""
      : reference?.tierAtFlight ?? currentMembership?.tier ?? "",
    cancelled: Boolean(flight.cancelled), divertedToIata: flight.divertedTo?.iata ?? "",
  };
}

export interface FlightIdentity {
  airlineCode: string; serviceNumber: string; canonical: string; airline: KeeprawFlight["airline"];
}

export function normalizeFlightNumberInput(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function splitFlightNumberInput(value: string): FlightIdentity | null {
  const normalized = normalizeFlightNumberInput(value);
  const match = normalized.match(/^([A-Z0-9]{2}|[A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if (!match) return null;
  const airlineCode = match[1]!;
  const serviceNumber = match[2]!;
  const resolved = resolveAirline(airlineCode);
  return {
    airlineCode, serviceNumber, canonical: `${airlineCode}${serviceNumber}`,
    airline: resolved ? { iata: resolved.iata, icao: resolved.icao }
      : airlineCode.length === 2 ? { iata: airlineCode } : { icao: airlineCode },
  };
}

export function flightFromDraft(draft: FlightDraft, existing?: KeeprawFlight): KeeprawFlight {
  const origin = airportByIata.get(draft.originIata);
  const destination = airportByIata.get(draft.destinationIata);
  if (!origin || !destination) throw new Error("unknown-airport");
  if (draft.cancelled && draft.divertedToIata) throw new Error("cancelled-diverted-conflict");
  const identity = splitFlightNumberInput(draft.flightNumber);
  if (!identity) throw new Error("invalid-flight-number");
  const scheduledDeparture = zonedDateTimeToIso(draft.serviceDate, draft.departureTime, origin.timezone);
  const scheduledArrival = zonedDateTimeToIso(draft.arrivalDate, draft.arrivalTime, destination.timezone);
  if (Date.parse(scheduledArrival) <= Date.parse(scheduledDeparture)) throw new Error("arrival-before-departure");
  const actualDeparture = optionalZonedDateTime(draft.actualDepartureDate, draft.actualDepartureTime, origin.timezone);
  const divertedTo = draft.divertedToIata ? airportByIata.get(draft.divertedToIata) : undefined;
  if (draft.divertedToIata && !divertedTo) throw new Error("unknown-airport");
  const actualArrival = optionalZonedDateTime(draft.actualArrivalDate, draft.actualArrivalTime, (divertedTo ?? destination).timezone);
  if (actualDeparture && actualArrival && Date.parse(actualArrival) <= Date.parse(actualDeparture)) throw new Error("actual-arrival-before-departure");
  const bookingClass = draft.bookingClass.trim().toUpperCase();
  if (bookingClass && !/^[A-Z]$/.test(bookingClass)) throw new Error("invalid-booking-class");
  const extensions = updateKnownExtensions(existing?.extensions, draft, bookingClass);
  const nextFlight: KeeprawFlight = {
    ...existing, id: existing?.id ?? `flight-${crypto.randomUUID()}`, flightNumber: identity.canonical,
    serviceDate: draft.serviceDate, airline: airlineReference(existing?.airline, identity),
    origin: endpointWithOptionalFacts(existing?.origin, draft.originIata, draft.originTerminal, draft.originGate),
    destination: endpointWithOptionalFacts(existing?.destination, draft.destinationIata, draft.destinationTerminal, draft.destinationGate),
    ...(divertedTo ? { divertedTo: { iata: divertedTo.iata } } : {}),
    ...(draft.cancelled ? { cancelled: true } : {}),
    scheduledDeparture, scheduledArrival,
    ticketNumber: draft.ticketNumber.trim() ? normalizeTicketNumber(draft.ticketNumber) : null,
    bookingReference: draft.bookingReference.trim() || null,
    baggageCarousel: draft.baggageCarousel.trim() || null,
  };
  if (!draft.cancelled && !divertedTo) delete nextFlight.cancelled;
  if (!divertedTo) delete nextFlight.divertedTo;
  if (draft.frequentFlyerMembershipId.trim()) {
    nextFlight.frequentFlyer = {
      membershipId: draft.frequentFlyerMembershipId.trim(),
      tierAtFlight: draft.frequentFlyerTierAtFlight.trim() || null,
    };
  } else {
    delete nextFlight.frequentFlyer;
  }
  if (actualDeparture) nextFlight.actualDeparture = actualDeparture; else delete nextFlight.actualDeparture;
  if (actualArrival) nextFlight.actualArrival = actualArrival; else delete nextFlight.actualArrival;
  if (extensions) nextFlight.extensions = extensions; else delete nextFlight.extensions;
  return nextFlight;
}

function airlineReference(existing: KeeprawFlight["airline"] | undefined, identity: FlightIdentity): KeeprawFlight["airline"] {
  const { iata: _iata, icao: _icao, ...preserved } = existing ?? {};
  return { ...preserved, ...identity.airline };
}

function optionalZonedDateTime(date: string, time: string, timezone: string): string | undefined {
  if (!date && !time) return undefined;
  if (!date || !time) throw new Error("incomplete-actual-time");
  return zonedDateTimeToIso(date, time, timezone);
}

function endpointWithOptionalFacts(existing: AirportEndpoint | undefined, iata: string, terminal: string, gate: string): AirportEndpoint {
  const sameAirport = existing?.iata === iata ? existing : { iata };
  const { terminal: _terminal, gate: _gate, ...preserved } = sameAirport;
  return { ...preserved, iata, ...(terminal.trim() ? { terminal: terminal.trim() } : {}), ...(gate.trim() ? { gate: gate.trim() } : {}) };
}


function updateKnownExtensions(existing: ExtensionMap | undefined, draft: FlightDraft, bookingClass: string): ExtensionMap | undefined {
  const extensions: ExtensionMap = structuredClone(existing ?? {});
  updateExtensionObject(extensions, "keepraw-fly.aircraft", { type: draft.aircraftType.trim(), registration: draft.aircraftRegistration.trim() });
  updateExtensionObject(extensions, "keepraw-fly.seat", { seat: draft.seat.trim(), cabin: draft.cabin.trim(), bookingClass });
  delete extensions["keepraw-fly.baggage"];
  delete extensions["keepraw-fly.ticket"];
  delete extensions["keepraw-fly.frequent-flyer"];
  return Object.keys(extensions).length ? extensions : undefined;
}

function updateExtensionObject(extensions: ExtensionMap, key: string, values: Record<string, JsonValue | undefined>) {
  const current = extensions[key];
  const object: Record<string, JsonValue> = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value === "") delete object[field]; else object[field] = value;
  }
  if (Object.keys(object).length) extensions[key] = object; else delete extensions[key];
}

export function zonedDateTimeToIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) throw new Error("invalid-local-time");
  const wallTime = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const candidates: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = wallTime - offset * 60_000;
    const observed = partsAtInstant(new Date(instant), timezone);
    if (Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute) === wallTime) candidates.push(instant);
  }
  if (candidates.length === 0) throw new Error("nonexistent-local-time");
  if (candidates.length > 1) throw new Error("ambiguous-local-time");
  const instant = candidates[0]!;
  const offsetMinutes = Math.round((wallTime - instant) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date}T${time}:00${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
}

export function localPartsAtAirport(iso: string, timezone: string) {
  const parts = partsAtInstant(new Date(iso), timezone);
  return { date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`, time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` };
}

function partsAtInstant(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
