import type { KeeprawFlight } from "@keepraw-fly/schema";
import { describe, expect, it } from "vitest";
import airportRows from "../data/airports.iata.json";
import {
  airportByIata,
  airportCityGroupByCode,
  airportCityGroupForAirport,
  airports,
  aircraftFacts,
  baggageFacts,
  buildRouteSegments,
  calculateYearStatistics,
  calculatePassportStatistics,
  departureDelayMinutes,
  distanceKilometers,
  formatTimeAtAirport,
  formatDuration,
  flightOperationalStatus,
  flightDuration,
  groupFlightsByYear,
  installAirportDirectory,
  localizedText,
  recentAirportCodes,
  searchFlights,
  searchAirports,
  seatFacts,
  airlineNames,
  canonicalAirlineCode,
  autoMatchedMembership,
  formatTicketNumber,
  frequentFlyerMemberships,
  frequentFlyerSnapshot,
  normalizeTicketNumber,
  normalizeMembershipAirlines,
  resolveAirline,
  searchAirlines,
  ticketFacts,
  withFrequentFlyerMemberships,
} from "../src";
import type { CompactAirportRow } from "../src";

installAirportDirectory(airportRows as CompactAirportRow[]);

const flight: KeeprawFlight = {
  id: "ua123",
  flightNumber: "UA123",
  serviceDate: "2026-08-19",
  airline: { iata: "UA" },
  origin: { iata: "SFO" },
  destination: { iata: "LAX" },
  scheduledDeparture: "2026-08-19T10:20:00-07:00",
  scheduledArrival: "2026-08-19T11:52:00-07:00",
  actualDeparture: "2026-08-19T10:57:00-07:00",
  actualArrival: "2026-08-19T12:21:00-07:00",
  extensions: {
    "keepraw-fly.aircraft": { type: "B789", registration: "N12345" },
  },
};

describe("flight calculations", () => {
  it("derives delay and actual duration from offset datetimes", () => {
    expect(departureDelayMinutes(flight)).toBe(37);
    expect(flightDuration(flight)).toEqual({ minutes: 84, source: "actual" });
  });

  it("falls back to scheduled duration when actual times are incomplete", () => {
    expect(flightDuration({ ...flight, actualArrival: undefined })).toEqual({
      minutes: 92,
      source: "scheduled",
    });
  });

  it("uses reference coordinates for great-circle distance", () => {
    const sfo = airportByIata.get("SFO")!;
    const lax = airportByIata.get("LAX")!;
    expect(Math.round(distanceKilometers(sfo, lax))).toBe(544);
  });

  it("formats the stored instant in airport-local time", () => {
    expect(
      formatTimeAtAirport(flight.scheduledDeparture, "SFO", "en", "24-hour"),
    ).toBe("10:20");
  });

  it("formats duration without coupling it to distance units", () => {
    expect(formatDuration(84, "en")).toBe("1h 24m");
    expect(formatDuration(84, "zh-CN")).toBe("1小时 24分");
    expect(formatDuration(84, "zh-TW")).toBe("1小時 24分");
  });

  it("reads known UI facts without disturbing the extension map", () => {
    expect(aircraftFacts(flight)).toEqual({
      type: "B789",
      registration: "N12345",
    });
    expect(flight.extensions?.["keepraw-fly.aircraft"]).toEqual({
      type: "B789",
      registration: "N12345",
    });
  });

  it("reads booking class and a string baggage carousel without a checked-baggage flag", () => {
    const withPersonalFacts: KeeprawFlight = {
      ...flight,
      baggageCarousel: "A3",
      extensions: { "keepraw-fly.seat": { seat: "14F", cabin: "economy", bookingClass: "P" } },
    };

    expect(seatFacts(withPersonalFacts)).toEqual({
      seat: "14F",
      cabin: "economy",
      bookingClass: "P",
    });
    expect(baggageFacts(withPersonalFacts)).toEqual({ carousel: "A3" });
    expect(baggageFacts({ ...flight, extensions: undefined })).toBeNull();
  });

  it("derives status from the latest recorded operational event", () => {
    expect(flightOperationalStatus(flight)).toBe("delayed");
    expect(flightOperationalStatus({
      ...flight,
      actualDeparture: "2026-08-19T10:10:00-07:00",
      actualArrival: undefined,
    })).toBe("early");
    expect(flightOperationalStatus({
      ...flight,
      actualDeparture: flight.scheduledDeparture,
      actualArrival: undefined,
    })).toBe("onTime");
    expect(flightOperationalStatus({
      ...flight,
      actualDeparture: undefined,
      actualArrival: undefined,
    })).toBe("scheduled");
    expect(flightOperationalStatus({ ...flight, cancelled: true })).toBe("cancelled");
    expect(flightOperationalStatus({ ...flight, divertedTo: { iata: "SFO" } })).toBe("diverted");
  });
});

describe("search and grouping", () => {
  const tokyoFlights: KeeprawFlight[] = [
    {
      ...flight,
      id: "nrt-flight",
      flightNumber: "JL58",
      airline: { iata: "JL" },
      origin: { iata: "NRT" },
      destination: { iata: "SFO" },
    },
    {
      ...flight,
      id: "hnd-flight",
      flightNumber: "NH107",
      airline: { iata: "NH" },
      origin: { iata: "LAX" },
      destination: { iata: "HND" },
    },
  ];
  const flights = [flight, ...tokyoFlights];

  it.each([
    ["UA123", ["ua123"]],
    ["UA", ["ua123"]],
    ["United", ["ua123"]],
    ["美国联合航空", ["ua123"]],
    ["LAX", ["ua123", "hnd-flight"]],
    ["Los Angeles International Airport", ["ua123", "hnd-flight"]],
    ["洛杉矶", ["ua123", "hnd-flight"]],
    ["2026", ["ua123", "nrt-flight", "hnd-flight"]],
    ["B789", ["ua123", "nrt-flight", "hnd-flight"]],
    ["N12345", ["ua123", "nrt-flight", "hnd-flight"]],
  ] as const)("matches %s in core", (query, expectedIds) => {
    expect(searchFlights(flights, query).map((item) => item.id)).toEqual(expectedIds);
  });

  it.each(["Tokyo", "东京"])("finds both Tokyo airports for %s", (query) => {
    expect(searchFlights(flights, query).map((item) => item.id)).toEqual([
      "nrt-flight",
      "hnd-flight",
    ]);
  });

  it("normalizes full-width user input and supports multiple terms", () => {
    expect(searchFlights(flights, "ＵＡ１２３ SFO").map((item) => item.id)).toEqual([
      "ua123",
    ]);
  });

  it("sorts year groups newest first", () => {
    const older = { ...flight, id: "older", serviceDate: "2025-01-02" };
    expect(groupFlightsByYear([older, flight]).map((group) => group.year)).toEqual([
      "2026",
      "2025",
    ]);
  });

  it("offers unique recent airports in newest-flight order", () => {
    const older = { ...flight, id: "older", serviceDate: "2025-01-02", origin: { iata: "JFK" } };
    expect(recentAirportCodes([older, flight])).toEqual(["SFO", "LAX", "JFK"]);
    expect(recentAirportCodes([older, flight], 2)).toEqual(["SFO", "LAX"]);
  });
});

describe("offline airport directory", () => {
  it("bundles global IATA airports with coordinates and timezones", () => {
    expect(airports.length).toBeGreaterThan(7_800);
    expect(airportByIata.get("TAO")).toMatchObject({
      iata: "TAO",
      name: { en: "Qingdao Jiaodong International Airport", "zh-CN": "青岛胶东国际机场" },
      city: { en: "Qingdao", "zh-CN": "青岛" },
      timezone: "Asia/Shanghai",
    });
    expect(airportByIata.get("SZX")).toMatchObject({
      iata: "SZX",
      name: { en: "Shenzhen Bao'an International Airport", "zh-CN": "深圳宝安国际机场", "zh-TW": "深圳寶安國際機場" },
      city: { en: "Shenzhen", "zh-CN": "深圳", "zh-TW": "深圳" },
      timezone: "Asia/Shanghai",
    });
  });

  it.each([
    ["SZX", "深圳", "深圳宝安国际机场"],
    ["TAO", "青岛", "青岛胶东国际机场"],
    ["HKG", "香港", "香港国际机场"],
    ["BOM", "孟买", "贾特拉帕蒂·希瓦吉·马哈拉杰国际机场"],
    ["LAX", "洛杉矶", "洛杉矶国际机场"],
    ["SFO", "旧金山", "旧金山国际机场"],
    ["TPE", "桃园", "台湾桃园国际机场"],
  ])("localizes %s for Chinese display", (code, city, name) => {
    expect(airportByIata.get(code)).toMatchObject({ city: { "zh-CN": city }, name: { "zh-CN": name } });
  });

  it("stores generated zh-CN airport labels as simplified Chinese", () => {
    const sfo = airportByIata.get("SFO")!;
    expect(sfo.city["zh-CN"]).toBe("旧金山");
    expect(sfo.name["zh-CN"]).toBe("旧金山国际机场");
    expect(sfo.name["zh-CN"]).not.toMatch(/舊|國際|機場/);
    expect(airportByIata.get("HKG")).toMatchObject({
      city: { "zh-CN": "香港" },
      name: { "zh-CN": "香港国际机场" },
    });
    expect(airportByIata.get("BOM")?.city["zh-CN"]).toBe("孟买");
    expect(airportByIata.get("TPE")).toMatchObject({
      city: { "zh-CN": "桃园" },
      name: { "zh-CN": "台湾桃园国际机场" },
    });
  });

  it("stores and resolves generated zh-TW airport labels as traditional Chinese", () => {
    const tao = airportByIata.get("TAO")!;
    expect(localizedText(tao.city, "zh-TW")).toBe("青島");
    expect(localizedText(tao.name, "zh-TW")).toBe("青島膠東國際機場");
    expect(localizedText(tao.name, "zh-TW")).not.toMatch(/青岛|国际机场/);
  });

  it.each(["TAO", "Qingdao", "青岛", "Jiaodong"])("finds TAO from %s", (query) => {
    expect(searchAirports(query, "zh-CN").map((airport) => airport.iata)).toContain("TAO");
  });

  it.each([
    ["TYO", ["HND", "NRT"]],
    ["Tokyo", ["HND", "NRT"]],
    ["东京", ["HND", "NRT"]],
    ["BJS", ["PEK", "PKX"]],
    ["北京", ["PEK", "PKX"]],
  ] as const)("expands the multi-airport city %s", (query, expectedCodes) => {
    expect(searchAirports(query, "zh-CN").slice(0, 2).map((airport) => airport.iata))
      .toEqual(expectedCodes);
  });

  it("keeps city aliases separate from airport endpoints", () => {
    expect(airportByIata.has("TYO")).toBe(false);
    expect(airportCityGroupByCode.get("TYO")?.airportCodes).toEqual(["HND", "NRT"]);
    expect(airportCityGroupForAirport("NRT")?.code).toBe("TYO");
    expect(searchAirports("TYO", "zh-CN").map((airport) => airport.iata))
      .toEqual(["HND", "NRT"]);
    expect(searchAirports("SHA", "zh-CN").map((airport) => airport.iata))
      .toEqual(["SHA", "PVG"]);
  });

  it("adds maintained metropolitan corrections for New York and Chengdu", () => {
    expect(airportCityGroupByCode.get("NYC")?.airportCodes).toEqual(["EWR", "JFK", "LGA"]);
    expect(airportCityGroupByCode.get("CTU")?.airportCodes).toEqual(["CTU", "TFU"]);
  });
});

describe("airline and travel references", () => {
  it.each([
    ["ZH", "CSZ", "深圳航空", "Shenzhen Airlines"],
    ["3U", "CSC", "四川航空", "Sichuan Airlines"],
    ["CCA", "CCA", "中国国际航空", "Air China"],
  ])("resolves %s through IATA or ICAO", (code, icao, nameZh, nameEn) => {
    const airline = resolveAirline(code)!;
    expect(airline.icao).toBe(icao);
    expect(airlineNames(airline, "zh-CN")).toEqual([nameZh, nameEn]);
    expect(airlineNames(airline, "zh-TW")[1]).toBe(nameEn);
  });

  it("normalizes standard tickets and preserves non-standard values", () => {
    expect(normalizeTicketNumber("781-1234567890")).toBe("7811234567890");
    expect(formatTicketNumber("7811234567890")).toBe("781-1234567890");
    expect(normalizeTicketNumber("stock-control-7")).toBe("stock-control-7");
    expect(ticketFacts({ ...flight, ticketNumber: "7811234567890" }))
      .toEqual({ number: "7811234567890" });
  });

  it("matches one membership, requires a choice for ambiguity, and honors an explicit default", () => {
    const base = { programId: "phoenixmiles", memberNumber: "CA123", associatedAirlines: ["CA", "ZH"], defaultAirline: null };
    const first = { ...base, id: "first" };
    const second = { ...base, id: "second", memberNumber: "CA456" };
    expect(autoMatchedMembership([first], { iata: "CA" })?.id).toBe("first");
    expect(autoMatchedMembership([first, second], { iata: "CA" })).toBeUndefined();
    expect(autoMatchedMembership([{ ...first, defaultAirline: "CA" }, second], { iata: "CA" })?.id).toBe("first");
  });

  it("searches airlines by IATA, ICAO, English, Simplified Chinese and Traditional Chinese", () => {
    expect(searchAirlines("ZH")[0]?.iata).toBe("ZH");
    expect(searchAirlines("CSZ")[0]?.iata).toBe("ZH");
    expect(searchAirlines("Shenzhen")[0]?.iata).toBe("ZH");
    expect(searchAirlines("中国国际航空")[0]?.iata).toBe("CA");
    expect(searchAirlines("中國國際航空")[0]?.iata).toBe("CA");
    expect(canonicalAirlineCode("CSZ")).toBe("ZH");
  });

  it("deduplicates associated airlines and maintains a valid default", () => {
    expect(normalizeMembershipAirlines(["ZH", "CSZ", "ZH"], null)).toEqual({
      associatedAirlines: ["ZH"],
      defaultAirline: "ZH",
    });
    expect(normalizeMembershipAirlines(["ZH", "CA"], "CA").defaultAirline).toBe("CA");
    expect(normalizeMembershipAirlines(["ZH"], "CA").defaultAirline).toBe("ZH");
    expect(normalizeMembershipAirlines(["ZH", "MU"], "CA").defaultAirline).toBeNull();
  });

  it("writes associated airlines as an array with a constrained singular default", () => {
    const document = withFrequentFlyerMemberships({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
    }, [{
      id: "ff-zh",
      programId: "phoenixmiles",
      memberNumber: "ZH123",
      associatedAirlines: ["CSZ", "CA", "ZH"],
      defaultAirline: "CCA",
    }]);

    expect(document.frequentFlyerMemberships?.[0]).toMatchObject({
      associatedAirlines: ["ZH", "CA"],
      defaultAirline: "CA",
    });
    expect(typeof document.frequentFlyerMemberships?.[0]?.associatedAirlines).toBe("object");
  });

  it("resolves member data from the account and keeps the per-flight tier immutable", () => {
    const document = { frequentFlyerMemberships: [{ id: "zh", programId: "phoenixmiles", memberNumber: "ZH123", tier: "金卡", associatedAirlines: ["ZH"] }] };
    expect(frequentFlyerMemberships(document as never)[0]?.tier).toBe("金卡");
    const snapshotted = { ...flight, frequentFlyer: { membershipId: "zh", tierAtFlight: "银卡" } };
    expect(frequentFlyerSnapshot(snapshotted, frequentFlyerMemberships(document as never), "zh-CN"))
      .toMatchObject({ programName: "凤凰知音", memberNumber: "ZH123", tierAtFlight: "银卡" });
  });
});

describe("passport statistics", () => {
  it("derives aggregate facts without storing them", () => {
    const stats = calculatePassportStatistics([flight]);
    expect(stats.flights).toBe(1);
    expect(stats.durationMinutes).toBe(84);
    expect(Math.round(stats.distanceKilometers)).toBe(544);
    expect(stats.airports).toBe(2);
    expect(stats.countries).toBe(1);
    expect(stats.mostFlownAirline).toEqual({ code: "UA", count: 1 });
    expect(stats.aircraftTypes).toBe(1);
  });

  it("ranks repeated airports and distance extremes across an archive", () => {
    const longFlight: KeeprawFlight = {
      ...flight,
      id: "mu589",
      flightNumber: "MU589",
      airline: { iata: "MU" },
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
      extensions: {
        "keepraw-fly.aircraft": { type: "B77W" },
      },
    };
    const stats = calculatePassportStatistics([flight, longFlight]);

    expect(stats.flights).toBe(2);
    expect(stats.countries).toBe(2);
    expect(stats.airports).toBe(3);
    expect(stats.airlines).toBe(2);
    expect(stats.aircraftTypes).toBe(2);
    expect(stats.mostVisitedAirport).toEqual({ code: "SFO", count: 2 });
    expect(stats.longestFlight?.flightId).toBe("mu589");
    expect(stats.shortestFlight?.flightId).toBe("ua123");
  });

  it("excludes cancelled flights from passport statistics and uses diverted airports for flown distance", () => {
    const cancelled = { ...flight, id: "cancelled", cancelled: true, actualDeparture: undefined, actualArrival: undefined };
    const diverted = { ...flight, id: "diverted", destination: { iata: "HND" }, divertedTo: { iata: "KIX" }, actualDeparture: "2026-08-19T10:57:00-07:00", actualArrival: "2026-08-20T13:21:00+09:00" };
    const stats = calculatePassportStatistics([cancelled, diverted]);
    expect(stats.flights).toBe(1);
    expect(stats.durationMinutes).toBe(624);
    expect(stats.longestFlight?.flightId).toBe("diverted");
    expect(stats.airports).toBe(2);
  });

  it("builds yearly summaries and map-ready route interfaces", () => {
    const older = { ...flight, id: "older", serviceDate: "2025-01-02" };
    expect(calculateYearStatistics([flight, older]).map((item) => item.year)).toEqual([
      2026,
      2025,
    ]);
    expect(buildRouteSegments([flight, { ...flight, id: "second" }])).toEqual([
      expect.objectContaining({
        origin: expect.objectContaining({ iata: "SFO" }),
        destination: expect.objectContaining({ iata: "LAX" }),
        flightCount: 2,
      }),
    ]);
  });

  it("calculates the six required yearly passport measures", () => {
    const returnFlight: KeeprawFlight = {
      ...flight,
      id: "return",
      flightNumber: "MU590",
      airline: { iata: "MU" },
      origin: { iata: "LAX" },
      destination: { iata: "SFO" },
    };
    const summaries = calculateYearStatistics([flight, returnFlight]);
    expect(summaries).toHaveLength(1);
    const summary = summaries[0];
    if (!summary) throw new Error("Expected a 2026 yearly summary");

    expect(summary).toEqual(expect.objectContaining({
      year: 2026,
      flights: 2,
      durationMinutes: 168,
      airlines: 2,
      airports: 2,
      routes: 2,
    }));
    expect(summary.distanceKilometers).toBeGreaterThan(1_000);
  });
});
