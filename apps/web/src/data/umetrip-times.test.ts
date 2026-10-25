import { describe, expect, it } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  airportByIata,
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import { inferUmetripTimes, umetripClock, umetripDate } from "./umetrip-times";

installAirportDirectory(airportRows as CompactAirportRow[]);

function times(
  origin: string,
  destination: string,
  serviceDate: string,
  departureTime: string,
  arrivalTime: string,
  arrivalDate?: string,
) {
  return inferUmetripTimes({
    origin: airportByIata.get(origin)!,
    destination: airportByIata.get(destination)!,
    serviceDate,
    departureTime,
    arrivalTime,
    arrivalDate,
  });
}

describe("Umetrip calendar and wall-clock cells", () => {
  it.each(["2024年2月29日", "2024-02-29", "2024/2/29", "2024.2.29"])(
    "reads an explicit calendar date: %s",
    (raw) => {
      expect(umetripDate(raw)).toBe("2024-02-29");
    },
  );
  it("distinguishes the 1900 and 1904 epochs without the fictitious leap day", () => {
    expect(umetripDate(1)).toBe("1900-01-01");
    expect(umetripDate(59)).toBe("1900-02-28");
    expect(umetripDate(61)).toBe("1900-03-01");
    expect(umetripDate(0, true)).toBe("1904-01-01");
    expect(umetripDate(43889)).toBe("2020-02-28");
  });
  it.each([
    null,
    "2023年2月29日",
    "2024-04-31",
    "02/03/2024",
    "2024年2月29日前有效",
    "2024-02/29",
    60,
    1.5,
    NaN,
    -1,
    2958466,
  ])("rejects an invalid or uncertain date: %s", (raw) => {
    expect(() => umetripDate(raw)).toThrow("invalid-date");
  });
  it.each([
    [0, "00:00"],
    [0.5, "12:00"],
    [23 / 24 + 59 / 1440, "23:59"],
    ["9:05", "09:05"],
    ["09:05:00", "09:05"],
  ] as const)("reads a minute-precision clock: %s", (raw, expected) => {
    expect(umetripClock(raw)).toBe(expected);
  });
  it.each([
    null,
    "24:00",
    "10:60",
    "10:00:01",
    "时间待定",
    "--",
    1,
    -0.1,
    NaN,
    0.50001,
  ])("rejects a missing, invalid or subminute clock: %s", (raw) => {
    expect(() => umetripClock(raw)).toThrow("invalid-time");
  });
});

describe("Umetrip arrival date inference", () => {
  it("keeps a same-day domestic arrival", () => {
    expect(times("PEK", "CAN", "2024-02-12", "10:00", "13:20")).toEqual({
      departure: "2024-02-12T10:00:00+08:00",
      arrival: "2024-02-12T13:20:00+08:00",
    });
  });
  it("uses both timezones when arriving after midnight", () => {
    expect(times("HKG", "BOM", "2024-02-12", "23:30", "03:00").arrival).toBe(
      "2024-02-13T03:00:00+05:30",
    );
  });
  it("can arrive earlier on the same local date without adding a day", () => {
    expect(times("HND", "LAX", "2024-02-12", "18:00", "11:00").arrival).toBe(
      "2024-02-12T11:00:00-08:00",
    );
  });
  it("can arrive on the previous local date across the date line", () => {
    expect(times("HND", "LAX", "2024-02-12", "00:30", "17:30").arrival).toBe(
      "2024-02-11T17:30:00-08:00",
    );
  });
  it("can arrive two local dates later across the date line", () => {
    expect(times("LAX", "HND", "2024-02-12", "23:30", "05:00").arrival).toBe(
      "2024-02-14T05:00:00+09:00",
    );
  });
  it("uses the offset at each endpoint on a DST transition", () => {
    expect(times("JFK", "LAX", "2024-03-10", "01:15", "05:30")).toEqual({
      departure: "2024-03-10T01:15:00-05:00",
      arrival: "2024-03-10T05:30:00-07:00",
    });
  });
  it.each([
    ["JFK", "LAX", "2024-03-10", "02:30", "06:00", "nonexistent-local-time"],
    ["JFK", "LAX", "2024-11-03", "01:30", "06:00", "ambiguous-local-time"],
    ["LAX", "JFK", "2024-03-09", "18:30", "02:30", "nonexistent-local-time"],
    ["LAX", "JFK", "2024-11-02", "17:30", "01:30", "ambiguous-local-time"],
  ])(
    "blocks uncertain DST clocks at either endpoint: %s to %s %s",
    (origin, destination, date, departure, arrival, error) => {
      expect(() =>
        times(origin, destination, date, departure, arrival),
      ).toThrow(error);
    },
  );
  it("rejects implausible short and next-day arrivals rather than choosing the nearest day", () => {
    expect(() => times("PEK", "CAN", "2024-02-12", "10:00", "10:15")).toThrow(
      "invalid-duration",
    );
    expect(() =>
      times("PEK", "CAN", "2024-02-12", "10:00", "13:20", "2024-02-13"),
    ).toThrow("invalid-duration");
  });
  it("accepts an explicit arrival date only when it is plausible", () => {
    expect(
      times("HKG", "BOM", "2024-02-12", "23:30", "03:00", "2024-02-13").arrival,
    ).toBe("2024-02-13T03:00:00+05:30");
  });
  it("rejects a missing or invalid destination timezone", () => {
    expect(() =>
      inferUmetripTimes({
        serviceDate: "2024-02-12",
        departureTime: "10:00",
        arrivalTime: "13:20",
        origin: airportByIata.get("PEK")!,
        destination: { ...airportByIata.get("CAN")!, timezone: "Invalid/Zone" },
      }),
    ).toThrow("invalid-timezone");
  });
});
