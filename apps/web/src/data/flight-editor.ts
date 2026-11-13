import type {
  AirportEndpoint,
  ExtensionMap,
  JsonValue,
  KeeprawFlight,
  KeeprawFlyDocument,
} from "@keepraw-fly/schema";
import {
  KEEPRAW_FLY_FORMAT,
  KEEPRAW_FLY_FORMAT_VERSION,
} from "@keepraw-fly/schema";
import {
  AIRPORT_TIMEZONE_EXTENSION,
  aircraftFacts,
  airportByIata,
  airportCityGroupByCode,
  baggageFacts,
  isFixedOffset,
  isTimezoneOrOffset,
  resolveEndpointIdentity,
  storedEndpointTimezone,
  normalizeTicketNumber,
  resolveAirline,
  seatFacts,
  ticketFacts,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

export interface FlightDraft {
  flightNumber: string;
  serviceDate: string;
  originIata: string;
  destinationIata: string;
  originAirportId?: string;
  destinationAirportId?: string;
  divertedAirportId?: string;
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
  destinationGate: string;
  aircraftType: string;
  aircraftRegistration: string;
  seat: string;
  cabin: string;
  bookingClass: string;
  baggageCarousel: string;
  ticketNumber: string;
  bookingReference: string;
  frequentFlyerMembershipId: string;
  frequentFlyerTierAtFlight: string;
  cancelled?: boolean;
  divertedToIata?: string;
  /**
   * IANA zone or `±HH:MM` offset the user confirmed for an endpoint whose
   * flight-date airport (and therefore zone) Keepraw cannot determine.
   */
  originTimezone?: string;
  destinationTimezone?: string;
  divertedTimezone?: string;
}

export type EndpointZoneRole = "origin" | "destination" | "divertedTo";

/** Thrown when a well-formed but undetermined airport has only a wall time. */
export class AirportTimezoneRequiredError extends Error {
  constructor(
    readonly role: EndpointZoneRole,
    readonly iata: string,
    readonly options: string[],
  ) {
    super("airport-timezone-required");
  }
}

/**
 * A three-letter code that may name an airport. Metropolitan city codes (TYO,
 * LON) are known not to be airports and stay rejected; any other well-formed
 * code is kept even when no directory or history layer knows it.
 */
export function isAirportCodeFormat(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false;
  return airportByIata.has(value) || !airportCityGroupByCode.has(value);
}

/**
 * The zone to read an endpoint's wall time in: the flight-date historical
 * airport's zone when it is determined, else the user's explicit choice.
 * Never defaults to UTC and never picks one of several candidate zones.
 */
export function endpointZone(
  iata: string,
  localDate: string,
  role: EndpointZoneRole,
  chosen: string | undefined,
  airportId?: string,
): { zone: string | null; userChosen: boolean; options: string[] } {
  const identity = resolveEndpointIdentity(
    iata,
    localDate || null,
    role === "origin"
      ? "origin"
      : role === "destination"
        ? "destination"
         : "arrival",
    null,
    airportId,
  );
  if (identity.timezone)
    return {
      zone: identity.timezone,
      userChosen: false,
      options: identity.timezoneOptions,
    };
  const explicit = chosen?.trim();
  if (explicit && isTimezoneOrOffset(explicit))
    return {
      zone: explicit,
      userChosen: true,
      options: identity.timezoneOptions,
    };
  return { zone: null, userChosen: false, options: identity.timezoneOptions };
}

/** `+08:00` from an RFC 3339 timestamp (Z becomes `+00:00`). */
export function writtenOffset(iso: string): string | null {
  const match = /(Z|[+-]\d{2}:\d{2})$/.exec(iso);
  if (!match) return null;
  return match[1] === "Z" ? "+00:00" : match[1]!;
}

function writtenLocalParts(iso: string) {
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function createEmptyDocument(): KeeprawFlyDocument {
  return {
    format: KEEPRAW_FLY_FORMAT,
    formatVersion: KEEPRAW_FLY_FORMAT_VERSION,
    profile: {},
    flights: [],
  };
}

export function createDefaultDraft(
  today = localDateString(new Date()),
): FlightDraft {
  return {
    flightNumber: "",
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
    destinationGate: "",
    aircraftType: "",
    aircraftRegistration: "",
    seat: "",
    cabin: "",
    bookingClass: "",
    baggageCarousel: "",
    ticketNumber: "",
    bookingReference: "",
    frequentFlyerMembershipId: "",
    frequentFlyerTierAtFlight: "",
    cancelled: false,
    divertedToIata: "",
  };
}

export function flightToDraft(
  flight: KeeprawFlight,
  options: {
    duplicate?: boolean;
    memberships?: readonly FrequentFlyerMembership[];
  } = {},
): FlightDraft {
  // Read each stored instant in its flight-date historical zone. An endpoint
  // Keepraw cannot place keeps the wall time and offset written in the record.
  const zoneFor = (
    iata: string,
    iso: string,
    role: EndpointZoneRole,
  ): { zone: string | null; chosen: string } => {
    const stored = storedEndpointTimezone(flight, role);
    const known = endpointZone(
      iata,
      role === "origin" ? flight.serviceDate : iso.slice(0, 10),
      role,
      undefined,
      flight[role]?.airportId,
    ).zone;
    if (known) return { zone: known, chosen: "" };
    if (stored) return { zone: stored, chosen: stored };
    return { zone: null, chosen: writtenOffset(iso) ?? "" };
  };
  const at = (iso: string, zone: string | null) =>
    zone ? localPartsAtAirport(iso, zone) : writtenLocalParts(iso);
  const originZone = zoneFor(
    flight.origin.iata,
    flight.scheduledDeparture,
    "origin",
  );
  const destinationZone = zoneFor(
    flight.destination.iata,
    flight.scheduledArrival,
    "destination",
  );
  const divertedZone = flight.divertedTo
    ? zoneFor(
        flight.divertedTo.iata,
        flight.actualArrival ?? flight.scheduledArrival,
        "divertedTo",
      )
    : null;
  const departure = at(flight.scheduledDeparture, originZone.zone);
  const arrival = at(flight.scheduledArrival, destinationZone.zone);
  const actualDeparture = flight.actualDeparture
    ? at(flight.actualDeparture, originZone.zone)
    : null;
  const actualArrival = flight.actualArrival
    ? at(flight.actualArrival, (divertedZone ?? destinationZone).zone)
    : null;
  const aircraft = aircraftFacts(flight);
  const seat = seatFacts(flight);
  const baggage = baggageFacts(flight);
  const ticket = ticketFacts(flight);
  const reference = flight.frequentFlyer;
  const currentMembership = options.memberships?.find(
    (membership) => membership.id === reference?.membershipId,
  );

  return {
    flightNumber: normalizeFlightNumberInput(flight.flightNumber),
    serviceDate: flight.serviceDate,
    originIata: flight.origin.iata,
    destinationIata: flight.destination.iata,
    originAirportId: flight.origin.airportId,
    destinationAirportId: flight.destination.airportId,
    divertedAirportId: flight.divertedTo?.airportId,
    departureTime: departure.time,
    arrivalDate: arrival.date,
    arrivalTime: arrival.time,
    actualDepartureDate: options.duplicate ? "" : (actualDeparture?.date ?? ""),
    actualDepartureTime: options.duplicate ? "" : (actualDeparture?.time ?? ""),
    actualArrivalDate: options.duplicate ? "" : (actualArrival?.date ?? ""),
    actualArrivalTime: options.duplicate ? "" : (actualArrival?.time ?? ""),
    originTerminal: flight.origin.terminal ?? "",
    originGate: options.duplicate ? "" : (flight.origin.gate ?? ""),
    destinationTerminal: flight.destination.terminal ?? "",
    destinationGate: options.duplicate ? "" : (flight.destination.gate ?? ""),
    aircraftType: aircraft?.type ?? "",
    aircraftRegistration: options.duplicate
      ? ""
      : (aircraft?.registration ?? ""),
    seat: options.duplicate ? "" : (seat?.seat ?? ""),
    cabin: seat?.cabin ?? "",
    bookingClass: seat?.bookingClass ?? "",
    baggageCarousel: options.duplicate ? "" : (baggage?.carousel ?? ""),
    ticketNumber: options.duplicate ? "" : (ticket?.number ?? ""),
    bookingReference: options.duplicate ? "" : (flight.bookingReference ?? ""),
    frequentFlyerMembershipId: reference?.membershipId ?? "",
    frequentFlyerTierAtFlight: options.duplicate
      ? (currentMembership?.tier ?? "")
      : (reference?.tierAtFlight ?? ""),
    cancelled: Boolean(flight.cancelled),
    divertedToIata: flight.divertedTo?.iata ?? "",
    originTimezone: originZone.chosen,
    destinationTimezone: destinationZone.chosen,
    divertedTimezone: divertedZone?.chosen ?? "",
  };
}

export interface FlightIdentity {
  airlineCode: string;
  serviceNumber: string;
  canonical: string;
  airline: KeeprawFlight["airline"];
}

export function normalizeFlightNumberInput(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

export function splitFlightNumberInput(value: string): FlightIdentity | null {
  const normalized = normalizeFlightNumberInput(value);
  const match = normalized.match(/^([A-Z0-9]{2}|[A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if (!match) return null;
  const airlineCode = match[1]!;
  const serviceNumber = match[2]!;
  const resolved = resolveAirline(airlineCode);
  return {
    airlineCode,
    serviceNumber,
    canonical: `${airlineCode}${serviceNumber}`,
    airline: resolved
      ? { iata: resolved.iata, icao: resolved.icao }
      : airlineCode.length === 2
        ? { iata: airlineCode }
        : { icao: airlineCode },
  };
}

export function flightFromDraft(
  draft: FlightDraft,
  existing?: KeeprawFlight,
  // Importers have already resolved offsets and DST; do not parse those instants
  // again through the editor's offset-free wall-clock fields.
  resolvedTimes?: Pick<
    KeeprawFlight,
    | "scheduledDeparture"
    | "scheduledArrival"
    | "actualDeparture"
    | "actualArrival"
  >,
): KeeprawFlight {
  // A well-formed IATA code is kept even when no directory or history layer
  // knows it: the flight is never dropped for an unknown airport name.
  const originIata = draft.originIata.trim().toUpperCase();
  const destinationIata = draft.destinationIata.trim().toUpperCase();
  const divertedToIata = (draft.divertedToIata ?? "").trim().toUpperCase();
  const originAirportId = draft.originAirportId ?? (existing?.origin.iata === originIata ? existing.origin.airportId : undefined);
  const destinationAirportId = draft.destinationAirportId ?? (existing?.destination.iata === destinationIata ? existing.destination.airportId : undefined);
  const divertedAirportId = draft.divertedAirportId ?? (existing?.divertedTo?.iata === divertedToIata ? existing.divertedTo.airportId : undefined);
  if (!isAirportCodeFormat(originIata) || !isAirportCodeFormat(destinationIata))
    throw new Error("unknown-airport");
  if (divertedToIata && !isAirportCodeFormat(divertedToIata))
    throw new Error("unknown-airport");
  if (draft.cancelled && divertedToIata)
    throw new Error("cancelled-diverted-conflict");
  const identity = splitFlightNumberInput(draft.flightNumber);
  if (!identity) throw new Error("invalid-flight-number");
  const originZone = endpointZone(
    originIata,
    draft.serviceDate,
    "origin",
    draft.originTimezone,
    originAirportId,
  );
  const destinationZone = endpointZone(
    destinationIata,
    draft.arrivalDate,
    "destination",
    draft.destinationTimezone,
    destinationAirportId,
  );
  const divertedZone = divertedToIata
    ? endpointZone(
        divertedToIata,
        draft.actualArrivalDate || draft.arrivalDate,
        "divertedTo",
        draft.divertedTimezone,
        divertedAirportId,
      )
    : null;
  const requireZone = (
    zone: ReturnType<typeof endpointZone>,
    role: EndpointZoneRole,
    iata: string,
  ): string => {
    if (zone.zone) return zone.zone;
    throw new AirportTimezoneRequiredError(role, iata, zone.options);
  };
  const scheduledDeparture =
    resolvedTimes?.scheduledDeparture ??
    zonedDateTimeToIso(
      draft.serviceDate,
      draft.departureTime,
      requireZone(originZone, "origin", originIata),
    );
  const scheduledArrival =
    resolvedTimes?.scheduledArrival ??
    zonedDateTimeToIso(
      draft.arrivalDate,
      draft.arrivalTime,
      requireZone(destinationZone, "destination", destinationIata),
    );
  if (Date.parse(scheduledArrival) <= Date.parse(scheduledDeparture))
    throw new Error("arrival-before-departure");
  const actualDeparture = resolvedTimes
    ? resolvedTimes.actualDeparture
    : draft.actualDepartureDate || draft.actualDepartureTime
      ? optionalZonedDateTime(
          draft.actualDepartureDate,
          draft.actualDepartureTime,
          requireZone(originZone, "origin", originIata),
        )
      : undefined;
  const divertedTo = divertedToIata ? { iata: divertedToIata } : undefined;
  const actualArrival = resolvedTimes
    ? resolvedTimes.actualArrival
    : draft.actualArrivalDate || draft.actualArrivalTime
      ? optionalZonedDateTime(
          draft.actualArrivalDate,
          draft.actualArrivalTime,
          divertedZone
            ? requireZone(divertedZone, "divertedTo", divertedToIata)
            : requireZone(destinationZone, "destination", destinationIata),
        )
      : undefined;
  if (
    actualDeparture &&
    actualArrival &&
    Date.parse(actualArrival) <= Date.parse(actualDeparture)
  )
    throw new Error("actual-arrival-before-departure");
  const bookingClass = draft.bookingClass.trim().toUpperCase();
  if (bookingClass && !/^[A-Z]$/.test(bookingClass))
    throw new Error("invalid-booking-class");
  const extensions = updateKnownExtensions(
    existing?.extensions,
    draft,
    bookingClass,
    {
      origin: originZone.userChosen ? originZone.zone : null,
      destination: destinationZone.userChosen ? destinationZone.zone : null,
      divertedTo: divertedZone?.userChosen ? divertedZone.zone : null,
    },
  );
  const nextFlight: KeeprawFlight = {
    ...existing,
    id: existing?.id ?? `flight-${crypto.randomUUID()}`,
    flightNumber: identity.canonical,
    serviceDate: draft.serviceDate,
    airline: airlineReference(existing?.airline, identity),
    origin: endpointWithOptionalFacts(
      existing?.origin,
      originIata,
      draft.originTerminal,
      draft.originGate,
      originAirportId,
    ),
    destination: endpointWithOptionalFacts(
      existing?.destination,
      destinationIata,
      draft.destinationTerminal,
      draft.destinationGate,
      destinationAirportId,
    ),
    ...(divertedTo
      ? {
          divertedTo: {
            ...(existing?.divertedTo?.iata === divertedTo.iata
              ? existing.divertedTo
              : {}),
            iata: divertedTo.iata,
            airportId: divertedAirportId,
          },
        }
      : {}),
    ...(draft.cancelled ? { cancelled: true } : {}),
    scheduledDeparture,
    scheduledArrival,
    ticketNumber: draft.ticketNumber.trim()
      ? normalizeTicketNumber(draft.ticketNumber)
      : null,
    bookingReference: draft.bookingReference.trim() || null,
    baggageCarousel: draft.baggageCarousel.trim() || null,
  };
  if (!draft.cancelled) delete nextFlight.cancelled;
  if (!divertedTo) delete nextFlight.divertedTo;
  if (draft.frequentFlyerMembershipId.trim()) {
    const membershipId = draft.frequentFlyerMembershipId.trim();
    const tierAtFlight = draft.frequentFlyerTierAtFlight.trim() || null;
    const reference = existing?.frequentFlyer;
    // Preserve an omitted historical tier as well as explicit null.
    nextFlight.frequentFlyer =
      reference?.membershipId === membershipId &&
      (reference.tierAtFlight ?? null) === tierAtFlight
        ? { ...reference }
        : { membershipId, tierAtFlight };
  } else {
    delete nextFlight.frequentFlyer;
  }
  if (actualDeparture) nextFlight.actualDeparture = actualDeparture;
  else delete nextFlight.actualDeparture;
  if (actualArrival) nextFlight.actualArrival = actualArrival;
  else delete nextFlight.actualArrival;
  if (extensions) nextFlight.extensions = extensions;
  else delete nextFlight.extensions;
  return nextFlight;
}

function airlineReference(
  existing: KeeprawFlight["airline"] | undefined,
  identity: FlightIdentity,
): KeeprawFlight["airline"] {
  const { iata: _iata, icao: _icao, ...preserved } = existing ?? {};
  return { ...preserved, ...identity.airline };
}

function optionalZonedDateTime(
  date: string,
  time: string,
  timezone: string,
): string | undefined {
  if (!date && !time) return undefined;
  if (!date || !time) throw new Error("incomplete-actual-time");
  return zonedDateTimeToIso(date, time, timezone);
}

function endpointWithOptionalFacts(
  existing: AirportEndpoint | undefined,
  iata: string,
  terminal: string,
  gate: string,
  airportId?: string,
): AirportEndpoint {
  const sameAirport = existing?.iata === iata ? existing : { iata };
  const { terminal: _terminal, gate: _gate, ...preserved } = sameAirport;
  return {
    ...preserved,
    iata,
    airportId,
    ...(terminal.trim() ? { terminal: terminal.trim() } : {}),
    ...(gate.trim() ? { gate: gate.trim() } : {}),
  };
}

function updateKnownExtensions(
  existing: ExtensionMap | undefined,
  draft: FlightDraft,
  bookingClass: string,
  zones: Record<EndpointZoneRole, string | null>,
): ExtensionMap | undefined {
  const extensions: ExtensionMap = structuredClone(existing ?? {});
  // User-confirmed zones for undetermined airports survive later edits.
  updateExtensionObject(extensions, AIRPORT_TIMEZONE_EXTENSION, {
    origin: zones.origin ?? undefined,
    destination: zones.destination ?? undefined,
    divertedTo: zones.divertedTo ?? undefined,
  });
  updateExtensionObject(extensions, "keepraw-fly.aircraft", {
    type: draft.aircraftType.trim(),
    registration: draft.aircraftRegistration.trim(),
  });
  updateExtensionObject(extensions, "keepraw-fly.seat", {
    seat: draft.seat.trim(),
    cabin: draft.cabin.trim(),
    bookingClass,
  });
  delete extensions["keepraw-fly.baggage"];
  delete extensions["keepraw-fly.ticket"];
  delete extensions["keepraw-fly.frequent-flyer"];
  return Object.keys(extensions).length ? extensions : undefined;
}

function updateExtensionObject(
  extensions: ExtensionMap,
  key: string,
  values: Record<string, JsonValue | undefined>,
) {
  const current = extensions[key];
  const object: Record<string, JsonValue> =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value === "") delete object[field];
    else object[field] = value;
  }
  if (Object.keys(object).length) extensions[key] = object;
  else delete extensions[key];
}

export function zonedDateTimeToIso(
  date: string,
  time: string,
  timezone: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part)))
    throw new Error("invalid-local-time");
  if (isFixedOffset(timezone)) return `${date}T${time}:00${timezone}`;
  const wallTime = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const candidates: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = wallTime - offset * 60_000;
    const observed = partsAtInstant(instant, timezone);
    if (
      Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
      ) === wallTime
    )
      candidates.push(instant);
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
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

// One fixed configuration is shared by imports and the editor. Bound the cache
// because airport data can be replaced; invalid zones are never cached.
const timezoneFormatters = new Map<string, Intl.DateTimeFormat>();

export function airportTimeFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = timezoneFormatters.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (timezoneFormatters.size >= 128)
    timezoneFormatters.delete(timezoneFormatters.keys().next().value!);
  timezoneFormatters.set(timezone, formatter);
  return formatter;
}

function partsAtInstant(date: Date | number, timezone: string) {
  const parts = airportTimeFormatter(timezone).formatToParts(date);
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
