import type { KeeprawFlight, JsonValue } from "@keepraw-fly/schema";

function asObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function stringField(value: Record<string, JsonValue> | null, field: string): string | undefined {
  const candidate = value?.[field];
  return typeof candidate === "string" ? candidate : undefined;
}

export interface AircraftFacts {
  type?: string;
  registration?: string;
}

export interface SeatFacts {
  seat?: string;
  cabin?: string;
}

export function aircraftFacts(flight: KeeprawFlight): AircraftFacts | null {
  const extension = asObject(flight.extensions?.["keepraw-fly.aircraft"]);
  if (!extension) return null;
  const facts = {
    type: stringField(extension, "type"),
    registration: stringField(extension, "registration"),
  };
  return facts.type || facts.registration ? facts : null;
}

export function seatFacts(flight: KeeprawFlight): SeatFacts | null {
  const extension = asObject(flight.extensions?.["keepraw-fly.seat"]);
  if (!extension) return null;
  const facts = {
    seat: stringField(extension, "seat"),
    cabin: stringField(extension, "cabin"),
  };
  return facts.seat || facts.cabin ? facts : null;
}

