// Copied into packages/core/tests by the remote diagnostic workflow.
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import {
  installAirportDirectory,
  originIdentity,
  arrivalIdentity,
  flightDistanceKilometers,
  calculatePassportStatistics,
  buildRouteSegments,
} from "../src";
import rows from "../data/airports.iata.json";
import archive from "../../../e2e/fixtures/share-poster.keepraw-fly.json";

test("record every passport fixture endpoint and distance", () => {
  installAirportDirectory(rows);
  const endpoint = (identity) => ({
    iata: identity.iata,
    airportId: identity.airportId,
    identityKey: identity.identityKey,
    point: identity.point,
    basis: identity.basis,
  });
  const report = {
    statistics: calculatePassportStatistics(archive.flights),
    routes: buildRouteSegments(archive.flights).length,
    flights: archive.flights.map((flight) => ({
      id: flight.id,
      date: flight.serviceDate,
      cancelled: flight.cancelled ?? false,
      origin: endpoint(originIdentity(flight)),
      arrival: endpoint(arrivalIdentity(flight)),
      kilometers: flightDistanceKilometers(flight),
    })),
  };
  writeFileSync(process.env.AUDIT_OUTPUT!, JSON.stringify(report, null, 2));
});
