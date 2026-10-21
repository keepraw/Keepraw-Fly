import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  calculatePassportStatistics,
  distanceForFlight,
  formatDistance,
} from "@keepraw-fly/core";
import { passportVisibleFlights } from "../data/passport-exploration";
import {
  buildPosterModel,
  MAX_POSTER_ROUTES,
  posterCenterLongitude,
  type PosterDataModel,
} from "./poster-data";
import {
  buildPosterCopy,
  posterMrzLine,
  posterNumberFormat,
  type PosterTranslate,
} from "./poster-copy";
import {
  createPosterLayout,
  POSTER_SAFE_INSET,
  POSTER_SIZE,
  posterAspectForViewport,
} from "./poster-layout";
import {
  DARK_PASSPORT_PALETTE,
  LIGHT_PASSPORT_PALETTE,
  posterPalette,
} from "./poster-render";
import {
  POSTER_MAP_RATIO,
  posterMapFrame,
  projectToFrame,
  routePolylines,
} from "./poster-map";
import { buildShareRenderModel } from "./share-model";
import { createInstance } from "i18next";
import { i18nOptions } from "../locales/test-resources";

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
  // A cancelled-only year never widens the archive span.
  flight("2022-01-01", "PEK", "PVG", { cancelled: true }),
];

// formatParams only carries the ungrouped number style; keep keys readable.
const t: PosterTranslate = (key, options) => {
  if (!options) return key;
  const { formatParams, ...values } = options;
  if (formatParams)
    for (const name of Object.keys(values))
      expect(formatParams).toHaveProperty([name, "useGrouping"], false);
  return `${key}:${JSON.stringify(values)}`;
};

const CODES = ["PEK", "PVG", "HND", "SYD", "SFO", "NRT", "QQX", "LHR"];

describe("poster data model", () => {
  it("recomputes lifetime statistics from the full archive", () => {
    const model = buildPosterModel(archive);
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

  it("is independent of Passport year, search and selection state", () => {
    const visible = passportVisibleFlights(archive, {
      year: 2023,
      query: "SFO",
      selection: { kind: "airport", code: "SFO" },
      flightId: null,
      scrollFlightId: null,
    });
    expect(visible.length).toBeLessThan(archive.length);
    const full = buildPosterModel(archive);
    // The overlay always passes the complete archive; a filtered list differs.
    expect(buildPosterModel(visible).statistics.flights).not.toBe(
      full.statistics.flights,
    );
    expect(full.statistics.flights).toBe(9);
  });

  it("keeps the 3A share statistics and the poster statistics identical", () => {
    const share = buildShareRenderModel(archive).model.statistics;
    expect(buildPosterModel(archive).statistics).toEqual(share);
  });

  it("builds an empty but valid model for an archive without flights", () => {
    const model = buildPosterModel([]);
    expect(model.statistics.flights).toBe(0);
    expect(model.yearRange).toBeNull();
    expect(model.map.routes).toEqual([]);
    expect(model.map.totalRoutes).toBe(0);
    expect(buildPosterCopy(model, t, "en-US", "kilometers").map.note).toBe(
      null,
    );
  });

  it("does not modify the archive", () => {
    const before = JSON.stringify(archive);
    buildPosterModel(archive);
    expect(JSON.stringify(archive)).toBe(before);
  });
});

describe("poster privacy and routes", () => {
  const serialize = (model: PosterDataModel) => JSON.stringify(model);

  it("whitelists the model: totals, span and unlabelled route geometry only", () => {
    const model = buildPosterModel(archive);
    expect(Object.keys(model).sort()).toEqual(
      ["map", "statistics", "version", "yearRange"].sort(),
    );
    expect(Object.keys(model.map).sort()).toEqual(
      [
        "airports",
        "centerLongitude",
        "curated",
        "routes",
        "totalRoutes",
      ].sort(),
    );
    for (const route of model.map.routes)
      expect(Object.keys(route).sort()).toEqual(["flights", "from", "to"]);
    for (const airport of model.map.airports)
      expect(Object.keys(airport).sort()).toEqual([
        "flights",
        "latitude",
        "longitude",
      ]);
    const text = serialize(model);
    // Airport codes and names never enter the model, in any mode.
    for (const code of CODES) expect(text).not.toContain(code);
    for (const sentinel of SENTINELS) expect(text).not.toContain(sentinel);
    expect(text).not.toMatch(/serviceDate|flightNumber|code|name|2025-|2023-/);
  });

  it("draws every real route by default, with the cancelled one left out", () => {
    const map = buildPosterModel(archive).map;
    // PEK–PVG (both directions merged), SFO–NRT, PEK–HND, PEK–SYD.
    expect(map.routes).toHaveLength(4);
    expect(map.totalRoutes).toBe(4);
    expect(map.curated).toBe(false);
    expect(map.routes[0]!.flights).toBe(3);
    // Real coordinates: PEK is near 40.08 N, 116.58 E.
    expect(
      map.airports.some(
        (airport) =>
          Math.abs(airport.latitude - 40.08) < 0.1 &&
          Math.abs(airport.longitude - 116.58) < 0.1,
      ),
    ).toBe(true);
    // Cancelled PEK–LHR never becomes a route (LHR is near 0° longitude).
    expect(
      map.routes.some(
        (route) =>
          Math.abs(route.to.longitude) < 1 ||
          Math.abs(route.from.longitude) < 1,
      ),
    ).toBe(false);
    const copy = buildPosterCopy(
      buildPosterModel(archive),
      t,
      "en-US",
      "kilometers",
    );
    expect(copy.map.note).toBe(
      `share.poster.routesAll:${JSON.stringify({ count: 4 })}`,
    );
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
    const model = buildPosterModel(dense);
    const map = model.map;
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
});

describe("poster copy, layout and palettes", () => {
  it("passes only strings and numbers to the drawing layer", () => {
    const copy = buildPosterCopy(
      buildPosterModel(archive),
      t,
      "en-US",
      "kilometers",
    );
    const walk = (value: unknown): void => {
      if (value === null) return;
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value === "object")
        return Object.values(value as object).forEach(walk);
      expect(["string", "number"]).toContain(typeof value);
    };
    walk(copy);
    expect(copy.brand).toBe("Keepraw Fly");
    expect(copy.title).toBe("share.poster.passportTitle");
    expect(copy.issuer).toBe(
      `share.poster.issuedBy:${JSON.stringify({ brand: "Keepraw Fly" })}`,
    );
    expect(copy.notes).toHaveLength(2);
    const text = JSON.stringify(copy);
    for (const code of CODES) expect(text).not.toContain(code);
    for (const sentinel of SENTINELS) expect(text).not.toContain(sentinel);
  });

  it("composes 3:4 and 4:3 separately at the two fixed sizes", () => {
    expect(POSTER_SIZE).toEqual({
      "3:4": { width: 1200, height: 1600 },
      "4:3": { width: 1600, height: 1200 },
    });
    const layouts = (["3:4", "4:3"] as const).map(createPosterLayout);
    for (const layout of layouts) {
      expect({ width: layout.width, height: layout.height }).toEqual(
        POSTER_SIZE[layout.aspect],
      );
      const { safe } = layout;
      expect(safe.x).toBe(POSTER_SAFE_INSET);
      const blocks = [layout.distance, ...layout.primary, ...layout.secondary];
      const baselines = [
        layout.brand.baseline,
        layout.title.baseline,
        layout.span.baseline,
        layout.notes.baseline,
        ...blocks.flatMap((block) => [block.label, block.baseline]),
        ...layout.mrz.lines,
      ];
      for (const y of baselines) {
        expect(y).toBeGreaterThan(safe.y);
        expect(y).toBeLessThan(safe.y + safe.height);
      }
      // Issuer shares the header row with the brand; nothing sits below
      // the machine-readable zone any more.
      expect(layout.issuer.baseline).toBe(layout.brand.baseline);
      expect(Math.max(...baselines)).toBe(layout.mrz.lines[1]);
      // The map keeps its true proportions inside the artboard.
      expect(layout.map.x).toBeGreaterThanOrEqual(0);
      expect(layout.map.x + layout.map.width).toBeLessThanOrEqual(layout.width);
      expect(layout.map.width / layout.map.height).toBeCloseTo(
        POSTER_MAP_RATIO,
        0,
      );
      // Readable small text and a calmer hierarchy.
      expect(layout.brand.size).toBeGreaterThanOrEqual(34);
      expect(layout.brand.size).toBeLessThanOrEqual(38);
      expect(layout.issuer.size).toBeGreaterThanOrEqual(24);
      expect(layout.issuer.size).toBeLessThan(layout.brand.size);
      expect(layout.notes.size).toBeGreaterThanOrEqual(24);
      expect(layout.mapNote.size).toBeGreaterThanOrEqual(24);
      expect(layout.span.labelSize).toBeGreaterThanOrEqual(26);
      for (const block of blocks) {
        expect(block.labelSize).toBeGreaterThanOrEqual(28);
        expect(block.labelSize).toBeLessThanOrEqual(32);
        // Label above figure, inside the block's own column.
        expect(block.baseline - block.label).toBeGreaterThan(block.size * 0.6);
        expect(block.x).toBeGreaterThanOrEqual(layout.left);
        expect(block.x + block.width).toBeLessThanOrEqual(layout.right + 0.5);
      }
      expect(layout.distance.size).toBeLessThanOrEqual(120);
      expect(layout.distance.size).toBeLessThan(layout.title.size * 1.5);
      for (const block of layout.primary)
        expect(block.size).toBeGreaterThanOrEqual(68);
      for (const block of layout.secondary)
        expect(block.size).toBeGreaterThanOrEqual(48);
      // Every row shares one label baseline and one figure baseline, and
      // every rule spans the same content width.
      for (const row of [layout.primary, layout.secondary]) {
        expect(new Set(row.map((block) => block.label)).size).toBe(1);
        expect(new Set(row.map((block) => block.baseline)).size).toBe(1);
      }
      for (const rule of layout.rules) {
        expect(rule.x0).toBe(layout.left);
        expect(rule.x1).toBe(layout.right);
      }
      // Rows read rule → label with the same spacing everywhere.
      const gaps = blocks.map(
        (block) =>
          block.label -
          Math.max(
            ...layout.rules.filter((r) => r.y < block.label).map((r) => r.y),
          ),
      );
      expect(new Set(gaps).size).toBe(1);
      // Columns start on grid lines shared across rows.
      const starts = new Set(blocks.map((block) => block.x));
      expect(starts.has(layout.left)).toBe(true);
    }
    const [portrait, landscape] = layouts;
    // 3:4: halves and thirds on one 6-column grid.
    expect(portrait!.primary[0].x).toBe(portrait!.secondary[0].x);
    expect(portrait!.primary[1].x).toBeGreaterThan(portrait!.secondary[1].x);
    expect(portrait!.primary[1].x).toBeLessThan(portrait!.secondary[2].x);
    // 4:3: distance, flights and time in one row; the stat columns start on
    // the same zone boundaries as the row below, and the map sits over them.
    expect(landscape!.distance.label).toBe(landscape!.primary[0].label);
    expect(landscape!.distance.baseline).toBe(landscape!.primary[0].baseline);
    expect(landscape!.primary.map((b) => b.x)).toEqual(
      landscape!.secondary.slice(1).map((b) => b.x),
    );
    expect(landscape!.map.x).toBeLessThanOrEqual(landscape!.primary[0].x);
    expect(landscape!.map.x + landscape!.map.width).toBeGreaterThan(
      landscape!.primary[1].x + landscape!.primary[1].width,
    );
    expect(portrait!.title.lines).toBe(1);
    expect(landscape!.title.lines).toBe(2);
  });

  it("formats poster numbers without digit grouping", () => {
    const many = Array.from({ length: 1234 }, (_, index) =>
      flight(
        "2024-05-01",
        index % 2 ? "PEK" : "JFK",
        index % 2 ? "JFK" : "PEK",
      ),
    );
    for (const locale of [
      "en-US",
      "de-DE",
      "fr-FR",
      "ja-JP",
      "zh-CN",
    ] as const) {
      const copy = buildPosterCopy(
        buildPosterModel(many),
        t,
        locale,
        "kilometers",
      );
      expect(copy.flights.value).toBe("1234");
      expect(copy.distance.value).toMatch(/^\d+$/);
      expect(Number(copy.distance.value)).toBeGreaterThan(10_000_000);
      expect(copy.duration.value).toMatch(/^\d+$/);
    }
    const miles = buildPosterCopy(buildPosterModel(many), t, "en-US", "miles");
    const km = buildPosterCopy(
      buildPosterModel(many),
      t,
      "en-US",
      "kilometers",
    );
    expect(Number(miles.distance.value)).toBe(
      Math.round(Number(km.distance.value) * 0.6213711922),
    );
    expect(posterNumberFormat("en-US").format(571474)).toBe("571474");
    // The app's own formatter keeps grouping.
    expect(formatDistance(571474, "en-US", "kilometers")).toBe("571,474");
  });

  it("keeps interpolated poster counts ungrouped with real translations", async () => {
    const instance = createInstance();
    await instance.init({ ...i18nOptions, lng: "en-US" });
    const many = Array.from({ length: 1500 }, (_, index) =>
      flight("2024-05-01", "PEK", "QQX", { id: `many-${index}` }),
    );
    const copy = buildPosterCopy(
      buildPosterModel(many),
      instance.t.bind(instance) as PosterTranslate,
      "en-US",
      "kilometers",
    );
    // QQX is unknown, so distance coverage is reported for all 1500.
    expect(copy.notes.join(" ")).toContain("of 1500 flights");
    expect(copy.notes.join(" ")).not.toMatch(/\d,\d{3}/);
    expect(copy.flights.value).toBe("1500");
  });

  it("picks the aspect from the viewport width at the 760 px breakpoint", () => {
    expect(posterAspectForViewport(320)).toBe("3:4");
    expect(posterAspectForViewport(760)).toBe("3:4");
    expect(posterAspectForViewport(761)).toBe("4:3");
    expect(posterAspectForViewport(1440)).toBe("4:3");
  });

  it("has two complete, opposite passport palettes", () => {
    expect(posterPalette("dark")).toBe(DARK_PASSPORT_PALETTE);
    expect(posterPalette("light")).toBe(LIGHT_PASSPORT_PALETTE);
    const luma = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return (
        0.2126 * ((value >> 16) & 255) +
        0.7152 * ((value >> 8) & 255) +
        0.0722 * (value & 255)
      );
    };
    const dark = DARK_PASSPORT_PALETTE;
    const light = LIGHT_PASSPORT_PALETTE;
    expect(luma(dark.backgroundTop)).toBeLessThan(60);
    expect(luma(light.backgroundTop)).toBeGreaterThan(200);
    expect(luma(dark.ink)).toBeGreaterThan(200);
    expect(luma(light.ink)).toBeLessThan(60);
    // Every role is themed, not just the background.
    for (const key of Object.keys(dark) as Array<keyof typeof dark>)
      if (key !== "map") expect(light[key], key).not.toEqual(dark[key]);
    for (const key of ["land", "route", "airport", "hub"] as const)
      expect(light.map[key], key).not.toEqual(dark.map[key]);
  });

  it("builds machine-readable lines only from brand and totals", () => {
    const copy = buildPosterCopy(
      buildPosterModel(archive),
      t,
      "en-US",
      "kilometers",
    );
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
