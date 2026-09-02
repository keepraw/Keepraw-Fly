import type { KeeprawFlight } from "@keepraw-fly/schema";
import type { AirportReference } from "./reference-data";

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

export function departureDelayMinutes(flight: KeeprawFlight): number | null {
  return flight.actualDeparture
    ? minutesBetween(flight.scheduledDeparture, flight.actualDeparture)
    : null;
}

export function arrivalDelayMinutes(flight: KeeprawFlight): number | null {
  return flight.actualArrival
    ? minutesBetween(flight.scheduledArrival, flight.actualArrival)
    : null;
}

export type FlightOperationalStatus = "scheduled" | "onTime" | "delayed" | "early";

export function flightOperationalStatus(flight: KeeprawFlight): FlightOperationalStatus {
  const delay = flight.actualArrival
    ? arrivalDelayMinutes(flight)
    : flight.actualDeparture
      ? departureDelayMinutes(flight)
      : null;

  if (delay === null) return "scheduled";
  if (delay > 0) return "delayed";
  if (delay < 0) return "early";
  return "onTime";
}

export interface FlightDuration {
  minutes: number;
  source: "actual" | "scheduled";
}

export function flightDuration(flight: KeeprawFlight): FlightDuration {
  if (flight.actualDeparture && flight.actualArrival) {
    return {
      minutes: minutesBetween(flight.actualDeparture, flight.actualArrival),
      source: "actual",
    };
  }

  return {
    minutes: minutesBetween(flight.scheduledDeparture, flight.scheduledArrival),
    source: "scheduled",
  };
}

export function distanceKilometers(
  origin: AirportReference,
  destination: AirportReference,
): number {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function kilometersToMiles(kilometers: number): number {
  return kilometers * 0.6213711922;
}
