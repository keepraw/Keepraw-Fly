import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  calculatePassportStatistics,
  distanceForFlight,
} from "@keepraw-fly/core";
import { passportVisibleFlights } from "../data/passport-exploration";
import {
  buildPosterModel,
  MAX_POSTER_MAP_LABELS,
  MAX_POSTER_ROUTES,
  MAX_TREND_YEARS,
  posterCenterLongitude,
  posterYears,
  type PosterDataModel,
} from "./poster-data";
import {
  buildPosterCopy,
  posterMrzLine,
  type PosterTranslate,
} from "./poster-copy";
import {
  createPosterLayout,
  defaultPosterAspect,
  POSTER_SAFE_INSET,
  POSTER_SIZE,
} from "./poster-layout";
import {
  POSTER_MAP_RATIO,
  posterMapFrame,
  projectToFrame,
  routePolylines,
} from "./poster-map";
import { buildShareRenderModel } from "./share-model";

const SENTINELS = [
  "SENTINEL_NAME",
  "SNTPNR",
  "9990000SENTINEL",
  "ZZ9876",
  "88K",
  "SENTGATE",
  "SENTTERM",
  "B-SENT1",
  "sentinel-id",
  "08:41",
];

let sequence = 0;
function flight(
  serviceDate: string,
  origin: string,
  destination: string,
  overrides: Partial<KeeprawFlight> = {},
): KeeprawFlight {
  sequence += 1;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(serviceDate)
    ? serviceDate
    : "2024-01-01";
  return {
    id: `sentinel-id-${sequence}`,
    flightNumber: "ZZ9876",
    serviceDate,
    airline: { iata: sequence % 2 ? "CA" : "MU" },
    origin: { iata: origin, terminal: "SENTTERM", gate: "SENTGATE" },
    destination: { iata: destination },
    scheduledDeparture: `${day}T08:41:00+08:00`,
    scheduledArrival: `${day}T11:11:00+08:00`,
    bookingReference: "SNTPNR",
    ticketNumber: "9990000SENTINEL",
    extensions: {
      "keepraw-fly.seat": { seat: "88K" },
      "keepraw-fly.aircraft": { registration: "B-SENT1" },
    },
    ...overrides,
  };
}

const archive: KeeprawFlight[] = [
  flight("2023-02-10", "PEK", "PVG"),
  flight("2023-02-21", "PVG", "PEK"),
  flight("2023-07-04", "SFO", "NRT"),
  flight("2025-03-01", "PEK", "HND"),
  flight("2025-03-09", "HND", "PEK"),
  flight("2025-03-17", "PEK", "SYD"),
  flight("2025-08-30", "SYD", "PEK"),
  flight("2025-11-02", "PEK", "LHR", { cancelled: true }),
  // Unknown airport: a counted flight with unknown distance.
  flight("2025-05-05", "QQX", "PVG"),
  // Invalid times: counted, but its duration is unknown.
  flight("2025-05-06", "PVG", "PEK", { scheduledDeparture: "broken" }),
  // Cancelled-only year never becomes a selectable poster year.
  flight("2022-01-01", "PEK", "PVG", { cancelled: true }),
];

const t: PosterTranslate = (key, options) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

describe("poster data model", () => {
  it("recomputes lifetime statistics from the full archive", () => {
    const model = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    const core = calculatePassportStatistics(archive);
    expect(model.statistics.flights).toBe(core.flights);
    expect(model.statistics.flights).toBe(9);
    expect(model.statistics.distanceKilometers).toBeCloseTo(
      core.distanceKilometers,
      6,
    );
    expect(model.statistics.distanceUnknownFlights).toBe(1);
    expect(model.statistics.airports).toBe(core.airports);
    expect(model.statistics.airlines).toBe(core.airlines);
    expect(model.statistics.countries).toBe(core.countries);
    // 8 reliable flights × 150 minutes; the broken one is excluded.
    expect(model.statistics.durationMinutes).toBe(8 * 150);
    expect(model.statistics.durationUnknownFlights).toBe(1);
    expect(model.yearRange).toEqual({ first: 2023, last: 2025 });
  });

  it("aggregates a gap-filled yearly trend for lifetime", () => {
    const model = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    expect(model.trend.kind).toBe("year");
    expect(model.trend.points.map((p) => [p.label, p.flights])).toEqual([
      [2023, 3],
      [2024, 0],
      [2025, 6],
    ]);
    const sum = model.trend.points.reduce((s, p) => s + p.flights, 0);
    expect(sum).toBe(model.statistics.flights);
    const distance2023 = archive
      .slice(0, 3)
      .reduce((s, f) => s + (distanceForFlight(f) ?? 0), 0);
    expect(model.trend.points[0]!.distanceKilometers).toBeCloseTo(
      distance2023,
      6,
    );
  });

  it("aggregates twelve months for a year and excludes cancelled flights", () => {
    const model = buildPosterModel(archive, {
      template: "year",
      scope: { kind: "year", year: 2025 },
    });
    expect(model.trend.kind).toBe("month");
    expect(model.trend.points).toHaveLength(12);
    expect(model.trend.points.map((p) => p.flights)).toEqual([
      0, 0, 3, 0, 2, 0, 0, 1, 0, 0, 0, 0,
    ]);
    expect(model.statistics.flights).toBe(6);
    expect(model.highlights).toEqual([
      {
        kind: "longestFlight",
        kilometers: model.statistics.longestFlightKilometers,
      },
      { kind: "busiestMonth", month: 3, flights: 3 },
    ]);
  });

  it("never invents a busiest month or a longest flight", () => {
    const tie = buildPosterModel(
      [flight("2024-01-01", "QQX", "PEK"), flight("2024-02-01", "QQX", "PVG")],
      { template: "year", scope: { kind: "year", year: 2024 } },
    );
    expect(tie.statistics.longestFlightKilometers).toBeNull();
    expect(tie.highlights).toEqual([{ kind: "airportsVisited", count: 3 }]);
    const empty = buildPosterModel([], {
      template: "year",
      scope: { kind: "year", year: 2024 },
    });
    expect(empty.highlights).toEqual([]);
    expect(empty.statistics.flights).toBe(0);
    expect(empty.trend.points.every((p) => p.flights === 0)).toBe(true);
    const lifetime = buildPosterModel([], {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    expect(lifetime.trend.points).toEqual([]);
    expect(lifetime.yearRange).toBeNull();
  });

  it("counts flights with invalid dates in totals but never in a bar", () => {
    const flights = [
      flight("2024-04-02", "PEK", "PVG"),
      flight("2024-13-02", "PEK", "PVG"),
      flight("unknown", "PEK", "PVG"),
    ];
    const lifetime = buildPosterModel(flights, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    expect(lifetime.statistics.flights).toBe(3);
    expect(lifetime.trend.undatedFlights).toBe(1);
    const year = buildPosterModel(flights, {
      template: "year",
      scope: { kind: "year", year: 2024 },
    });
    expect(year.statistics.flights).toBe(2);
    expect(year.trend.undatedFlights).toBe(1);
    expect(year.trend.points.reduce((s, p) => s + p.flights, 0)).toBe(1);
    const copy = buildPosterCopy(year, t, "en-US", "kilometers");
    expect(copy.notes.join(" ")).toContain("share.poster.undatedFlights");
  });

  it("caps very long lifetimes to recent years and says so", () => {
    const flights = Array.from({ length: 41 }, (_, index) =>
      flight(`${1985 + index}-06-01`, "PEK", "PVG"),
    );
    const model = buildPosterModel(flights, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    expect(model.trend.points).toHaveLength(MAX_TREND_YEARS);
    expect(model.trend.points.at(-1)!.label).toBe(2025);
    expect(model.trend.omittedYears).toBe(41 - MAX_TREND_YEARS);
    expect(model.statistics.flights).toBe(41);
    const copy = buildPosterCopy(model, t, "en-US", "kilometers");
    expect(copy.chart.title).toContain("flightsByRecentYears");
  });

  it("lists only years with non-cancelled flights, newest first", () => {
    expect(posterYears(archive)).toEqual([2025, 2023]);
    expect(posterYears([])).toEqual([]);
  });

  it("is independent of Passport search and selection state", () => {
    const visible = passportVisibleFlights(archive, {
      year: 2023,
      query: "SFO",
      selection: { kind: "airport", code: "SFO" },
      flightId: null,
      scrollFlightId: null,
    });
    expect(visible.length).toBeLessThan(archive.length);
    const full = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    // The Studio always passes the complete archive; a filtered list differs.
    expect(
      buildPosterModel(visible, {
        template: "passport",
        scope: { kind: "lifetime" },
      }).statistics.flights,
    ).not.toBe(full.statistics.flights);
  });

  it("keeps the 3A share statistics and the poster statistics identical", () => {
    const share = buildShareRenderModel(archive).model.statistics;
    const poster = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
    }).statistics;
    expect(poster).toEqual(share);
  });
});

describe("poster privacy", () => {
  const serialize = (model: PosterDataModel) => JSON.stringify(model);

  it("whitelists the overview model: no airports, routes or personal fields", () => {
    for (const template of ["passport", "year"] as const) {
      const model = buildPosterModel(archive, {
        template,
        scope:
          template === "year"
            ? { kind: "year", year: 2025 }
            : { kind: "lifetime" },
      });
      expect(Object.keys(model).sort()).toEqual(
        [
          "activeMonths",
          "airports",
          "highlights",
          "map",
          "privacy",
          "scope",
          "statistics",
          "template",
          "trend",
          "version",
          "yearRange",
        ].sort(),
      );
      expect(model.airports).toEqual([]);
      // Default privacy: no routes, no airport positions, fixed framing.
      expect(model.map).toBeNull();
      const text = serialize(model);
      for (const code of ["PEK", "PVG", "HND", "SYD", "SFO", "NRT", "QQX"])
        expect(text).not.toContain(code);
      for (const sentinel of SENTINELS) expect(text).not.toContain(sentinel);
      expect(text).not.toMatch(/latitude|longitude|serviceDate|flightNumber/);
      const built = buildPosterCopy(model, t, "en-US", "miles");
      expect(built.map).toEqual({
        routes: [],
        airports: [],
        centerLongitude: 0,
        note: null,
      });
      const copy = JSON.stringify(built);
      for (const code of ["PEK", "PVG", "HND", "SYD"])
        expect(copy).not.toContain(code);
      for (const sentinel of SENTINELS) expect(copy).not.toContain(sentinel);
    }
  });

  it("adds real routes and unlabelled airport dots only when routes are enabled", () => {
    const model = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
      privacy: "routes",
    });
    expect(model.map).not.toBeNull();
    const map = model.map!;
    // PEK–PVG (both directions merged), SFO–NRT, PEK–HND, PEK–SYD.
    expect(map.routes).toHaveLength(4);
    expect(map.totalRoutes).toBe(4);
    expect(map.curated).toBe(false);
    expect(map.routes[0]!.flights).toBe(3);
    for (const route of map.routes)
      expect(Object.keys(route).sort()).toEqual(["flights", "from", "to"]);
    for (const airport of map.airports) {
      expect(Object.keys(airport).sort()).toEqual([
        "flights",
        "latitude",
        "longitude",
      ]);
    }
    // No identifiers without the separate airport grant.
    const text = serialize(model);
    for (const code of ["PEK", "PVG", "HND", "SYD", "SFO", "NRT", "QQX"])
      expect(text).not.toContain(code);
    for (const sentinel of SENTINELS) expect(text).not.toContain(sentinel);
    expect(text).not.toMatch(/serviceDate|flightNumber|2025-|2023-/);
    expect(model.airports).toEqual([]);
    // Cancelled PEK–LHR never becomes a route.
    expect(
      map.routes.some(
        (route) =>
          Math.abs(route.to.longitude) < 1 ||
          Math.abs(route.from.longitude) < 1,
      ),
    ).toBe(false);
  });

  it("adds codes and names only with the separate airport grant", () => {
    const model = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
      privacy: "airports",
      locale: "zh-CN",
    });
    expect(model.airports.length).toBeLessThanOrEqual(3);
    expect(model.airports[0]).toEqual({
      code: "PEK",
      name: expect.any(String),
      visits: 7,
    });
    for (const airport of model.airports)
      expect(Object.keys(airport).sort()).toEqual(["code", "name", "visits"]);
    const labelled = model.map!.airports.filter((airport) => airport.code);
    expect(labelled.length).toBeGreaterThan(0);
    expect(labelled.length).toBeLessThanOrEqual(MAX_POSTER_MAP_LABELS);
    expect(labelled[0]!.code).toBe("PEK");
    const text = serialize(model);
    for (const sentinel of SENTINELS) expect(text).not.toContain(sentinel);
    expect(text).not.toMatch(/serviceDate|QQX/);
    // Turning it off removes every identifier and every position again.
    const off = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
      privacy: "overview",
    });
    expect(serialize(off)).not.toContain("PEK");
    expect(serialize(off)).not.toMatch(/latitude|longitude/);
  });

  it("routes follow the selected year, not the whole archive", () => {
    const year = buildPosterModel(archive, {
      template: "year",
      scope: { kind: "year", year: 2023 },
      privacy: "routes",
    }).map!;
    expect(year.routes.map((route) => route.flights).sort()).toEqual([1, 2]);
  });

  it("switches to a clearly marked curated selection on dense archives", () => {
    const codes = [
      "PEK",
      "PVG",
      "CAN",
      "HKG",
      "NRT",
      "HND",
      "ICN",
      "SIN",
      "BKK",
      "DXB",
      "LHR",
      "CDG",
      "FRA",
      "AMS",
      "JFK",
      "SFO",
      "LAX",
      "SYD",
    ];
    const dense: KeeprawFlight[] = [];
    codes.forEach((from, i) =>
      codes.forEach((to, j) => {
        if (j > i)
          dense.push(flight(`2024-0${1 + (j % 9)}-0${1 + (i % 9)}`, from, to));
      }),
    );
    const model = buildPosterModel(dense, {
      template: "passport",
      scope: { kind: "lifetime" },
      privacy: "routes",
    });
    const map = model.map!;
    expect(map.totalRoutes).toBe(
      buildShareRenderModel(dense, { privacy: "routes" }).model.routes.length,
    );
    expect(map.totalRoutes).toBeGreaterThan(MAX_POSTER_ROUTES);
    expect(map.routes).toHaveLength(MAX_POSTER_ROUTES);
    expect(map.curated).toBe(true);
    const copy = buildPosterCopy(model, t, "en-US", "kilometers");
    expect(copy.map.note).toBe(
      `share.poster.routesCurated:${JSON.stringify({ shown: MAX_POSTER_ROUTES, total: map.totalRoutes })}`,
    );
    // Totals still come from every flight, not from the drawn selection.
    expect(model.statistics.flights).toBe(dense.length);
  });

  it("does not modify the archive", () => {
    const before = JSON.stringify(archive);
    buildPosterModel(archive, {
      template: "year",
      scope: { kind: "year", year: 2025 },
      privacy: "airports",
    });
    expect(JSON.stringify(archive)).toBe(before);
  });
});

describe("poster copy and layout", () => {
  it("passes only strings and numbers to the drawing layer", () => {
    const model = buildPosterModel(archive, {
      template: "year",
      scope: { kind: "year", year: 2025 },
    });
    const copy = buildPosterCopy(model, t, "en-US", "kilometers");
    const walk = (value: unknown): void => {
      if (value === null) return;
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value === "object")
        return Object.values(value as object).forEach(walk);
      expect(["string", "number"]).toContain(typeof value);
    };
    walk(copy);
    expect(copy.chart.values).toEqual(model.trend.points.map((p) => p.flights));
    expect(copy.chart.labels).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(copy.chart.accentIndex).toBe(2);
    expect(copy.year).toBe("2025");
    expect(copy.notes).toHaveLength(2);
  });

  it("composes each template and aspect separately at the two fixed sizes", () => {
    const layouts = (["passport", "year"] as const).flatMap((template) =>
      (["3:4", "4:3"] as const).map((aspect) =>
        createPosterLayout(template, aspect),
      ),
    );
    expect(POSTER_SIZE).toEqual({
      "3:4": { width: 1200, height: 1600 },
      "4:3": { width: 1600, height: 1200 },
    });
    const signatures = new Set<string>();
    for (const layout of layouts) {
      expect({ width: layout.width, height: layout.height }).toEqual(
        POSTER_SIZE[layout.aspect],
      );
      const { safe } = layout;
      expect(safe.x).toBe(POSTER_SAFE_INSET);
      const baselines = [
        layout.header,
        layout.title.baseline,
        layout.distance.baseline,
        layout.primary.baseline,
        layout.secondary.label,
        layout.mapNote.baseline,
        ...(layout.footer ? [layout.footer.baseline] : []),
        ...(layout.mrz ? layout.mrz.lines : []),
        ...(layout.chart ? [layout.chart.labels] : []),
        ...(layout.highlights
          ? layout.highlights.rows.map((r) => r.baseline)
          : []),
      ];
      for (const y of baselines) {
        expect(y).toBeGreaterThan(safe.y);
        expect(y).toBeLessThan(safe.y + safe.height);
      }
      // The map keeps its true proportions inside the artboard.
      expect(layout.map.x).toBeGreaterThanOrEqual(0);
      expect(layout.map.x + layout.map.width).toBeLessThanOrEqual(layout.width);
      expect(layout.map.width / layout.map.height).toBeCloseTo(
        POSTER_MAP_RATIO,
        0,
      );
      signatures.add(JSON.stringify({ ...layout, aspect: "", template: "" }));
    }
    // 3:4 and 4:3 are composed independently, not crops or scaled copies.
    expect(signatures.size).toBe(layouts.length);
    const passport = createPosterLayout("passport", "3:4");
    const year = createPosterLayout("year", "3:4");
    // Two genuinely different compositions: chart and MRZ are template-only.
    expect(passport.chart).toBeNull();
    expect(passport.mrz).not.toBeNull();
    expect(year.chart).not.toBeNull();
    expect(year.mrz).toBeNull();
    expect(defaultPosterAspect(true)).toBe("3:4");
    expect(defaultPosterAspect(false)).toBe("4:3");
  });

  it("builds machine-readable lines only from brand, scope and totals", () => {
    const model = buildPosterModel(archive, {
      template: "passport",
      scope: { kind: "lifetime" },
    });
    const copy = buildPosterCopy(model, t, "en-US", "kilometers");
    expect(copy.mrz[0]).toMatch(/^KEEPRAW<FLY<<FLIGHT<PASSPORT<+$/);
    expect(copy.mrz[1]).toMatch(/^LIFETIME<<20232025<<9FLT<<\d+KM<<\d+H<*$/);
    for (const line of copy.mrz) {
      expect(line).toMatch(/^[A-Z0-9<]+$/);
      for (const sentinel of SENTINELS) expect(line).not.toContain(sentinel);
    }
    expect(posterMrzLine(["Ä b", "c"], 8)).toBe("A<B<<C<<");
  });
});

describe("poster map geometry", () => {
  const rect = { x: 0, y: 0, width: 1000, height: 1000 / POSTER_MAP_RATIO };

  it("splits a route that crosses the map seam instead of drawing across", () => {
    const sfo = { latitude: 37.62, longitude: -122.38 };
    const nrt = { latitude: 35.77, longitude: 140.39 };
    const atlantic = posterMapFrame(rect, 0);
    expect(routePolylines(atlantic, sfo, nrt)).toHaveLength(2);
    const pacific = posterMapFrame(rect, 160);
    const lines = routePolylines(pacific, sfo, nrt);
    expect(lines).toHaveLength(1);
    for (const line of lines)
      for (let i = 1; i < line.length; i += 1)
        expect(Math.abs(line[i]!.x - line[i - 1]!.x)).toBeLessThan(
          rect.width / 3,
        );
  });

  it("frames the map around the routes and keeps points inside the rect", () => {
    const routes = [
      {
        from: { latitude: 37.62, longitude: -122.38 },
        to: { latitude: 35.77, longitude: 140.39 },
        flights: 4,
      },
      {
        from: { latitude: 40.08, longitude: 116.58 },
        to: { latitude: 31.14, longitude: 121.8 },
        flights: 2,
      },
    ];
    const center = posterCenterLongitude(routes, [
      routes[0]!.from,
      routes[0]!.to,
      routes[1]!.from,
    ]);
    const frame = posterMapFrame(rect, center);
    for (const route of routes)
      expect(routePolylines(frame, route.from, route.to)).toHaveLength(1);
    for (const route of routes)
      for (const end of [route.from, route.to]) {
        const point = projectToFrame(frame, end)!;
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(rect.width);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(rect.height);
      }
    expect(posterCenterLongitude([], [])).toBe(0);
  });
});
