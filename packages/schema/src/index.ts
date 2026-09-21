export const KEEPRAW_FLY_FORMAT = "keepraw-fly" as const;
export const KEEPRAW_FLY_FORMAT_VERSION = "0.1.0" as const;

export type PrimaryName = "native" | "romanized";

export interface ProfileName {
  native?: string;
  romanized?: string;
  primary?: PrimaryName;
}

export interface KeeprawProfile {
  name?: ProfileName;
}

export interface AirlineReference {
  iata?: string;
  icao?: string;
}

export interface AirportEndpoint {
  iata: string;
  terminal?: string;
  gate?: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ExtensionMap = Record<string, JsonValue>;

export interface FrequentFlyerMembership {
  id: string;
  programId: string;
  /** Custom/legacy display name used only when the program reference is unknown. */
  programName?: string;
  memberNumber: string;
  tier?: string | null;
  associatedAirlines?: string[];
  defaultForAirlines?: string[];
}

export interface FlightFrequentFlyerReference {
  membershipId: string;
  /** Historical membership tier for this flight; it must not track the current tier. */
  tierAtFlight?: string | null;
}

export interface KeeprawFlight {
  id: string;
  flightNumber: string;
  serviceDate: string;
  airline: AirlineReference;
  origin: AirportEndpoint;
  destination: AirportEndpoint;
  scheduledDeparture: string;
  scheduledArrival: string;
  actualDeparture?: string;
  actualArrival?: string;
  ticketNumber?: string | null;
  bookingReference?: string | null;
  baggageCarousel?: string | null;
  frequentFlyer?: FlightFrequentFlyerReference;
  extensions?: ExtensionMap;
}

export interface KeeprawFlyDocument {
  format: typeof KEEPRAW_FLY_FORMAT;
  formatVersion: typeof KEEPRAW_FLY_FORMAT_VERSION;
  profile: KeeprawProfile;
  flights: KeeprawFlight[];
  frequentFlyerMemberships?: FrequentFlyerMembership[];
  extensions?: ExtensionMap;
}
