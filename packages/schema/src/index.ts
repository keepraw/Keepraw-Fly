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
  extensions?: ExtensionMap;
}

export interface KeeprawFlyDocument {
  format: typeof KEEPRAW_FLY_FORMAT;
  formatVersion: typeof KEEPRAW_FLY_FORMAT_VERSION;
  profile: KeeprawProfile;
  flights: KeeprawFlight[];
  extensions?: ExtensionMap;
}

