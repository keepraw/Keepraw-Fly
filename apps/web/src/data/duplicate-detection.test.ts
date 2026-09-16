import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  assessFlightImports,
  countFlightImportAssessments,
  selectFlightsForImport,
} from "./duplicate-detection";

describe("duplicate flight detection", () => {
  it("classifies a completely identical record as exact", () => {
    expect(classify(structuredClone(baseFlight))).toBe("exact");
  });

  it("classifies the same date, flight number and route with a different scheduled time as possible", () => {
    expect(classify({
      ...baseFlight,
      id: "candidate",
      scheduledDeparture: "2026-08-19T11:20:00-07:00",
      scheduledArrival: "2026-08-19T12:52:00-07:00",
    })).toBe("possible");
  });

  it("keeps the same flight number on a different date as new", () => {
    expect(classify({
      ...baseFlight,
      id: "candidate",
      serviceDate: "2026-08-20",
      scheduledDeparture: "2026-08-20T10:20:00-07:00",
      scheduledArrival: "2026-08-20T11:52:00-07:00",
    })).toBe("new");
  });

  it("keeps a same-day return flight in the opposite direction as new", () => {
    expect(classify({
      ...baseFlight,
      id: "candidate",
      origin: { iata: "LAX" },
      destination: { iata: "SFO" },
    })).toBe("new");
  });

  it("ignores differences in supplementary completeness", () => {
    const moreComplete: KeeprawFlight = {
      ...baseFlight,
      origin: { iata: "SFO", terminal: "3", gate: "F12" },
      extensions: { "keepraw-fly.cabin": { seat: "12A" } },
    };
    expect(assessFlightImports([{ ...baseFlight, id: "candidate" }], [moreComplete])[0]?.disposition).toBe("exact");
  });

  it("does not treat different actual times as a different flight", () => {
    const changedActuals: KeeprawFlight = {
      ...baseFlight,
      id: "candidate",
      actualDeparture: "2026-08-19T10:47:00-07:00",
      actualArrival: "2026-08-19T12:11:00-07:00",
    };
    expect(classify(changedActuals)).toBe("exact");
  });

  it("recognizes an exact cross-midnight flight without using its arrival date as identity", () => {
    const overnight: KeeprawFlight = {
      ...baseFlight,
      id: "overnight",
      flightNumber: "UA200",
      scheduledDeparture: "2026-08-19T23:30:00-07:00",
      scheduledArrival: "2026-08-20T07:45:00-04:00",
      destination: { iata: "JFK" },
    };
    const imported = {
      ...overnight,
      id: "candidate",
      actualArrival: "2026-08-20T08:02:00-04:00",
    };
    expect(assessFlightImports([imported], [overnight])[0]?.disposition).toBe("exact");
  });

  it("imports new records, skips exact duplicates and requires opt-in for possible duplicates", () => {
    const possible = {
      ...baseFlight,
      id: "possible",
      scheduledDeparture: "2026-08-19T11:20:00-07:00",
      scheduledArrival: "2026-08-19T12:52:00-07:00",
    };
    const fresh = {
      ...baseFlight,
      id: "fresh",
      serviceDate: "2026-08-20",
      scheduledDeparture: "2026-08-20T10:20:00-07:00",
      scheduledArrival: "2026-08-20T11:52:00-07:00",
    };
    const assessments = assessFlightImports([structuredClone(baseFlight), possible, fresh], [baseFlight]);

    expect(countFlightImportAssessments(assessments)).toEqual({
      newRecords: 1,
      possibleDuplicateRecords: 1,
      exactDuplicateRecords: 1,
    });
    expect(selectFlightsForImport(assessments).map(({ id }) => id)).toEqual(["fresh"]);
    expect(selectFlightsForImport(assessments, true).map(({ id }) => id)).toEqual(["possible", "fresh"]);
  });
});

function classify(candidate: KeeprawFlight) {
  return assessFlightImports([candidate], [baseFlight])[0]?.disposition;
}

const baseFlight: KeeprawFlight = {
  id: "existing",
  flightNumber: "UA123",
  serviceDate: "2026-08-19",
  airline: { iata: "UA" },
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2026-08-19T10:20:00-07:00",
  scheduledArrival: "2026-08-19T11:52:00-07:00",
  actualDeparture: "2026-08-19T10:37:00-07:00",
  actualArrival: "2026-08-19T12:01:00-07:00",
};
