import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import airportRows from "../data/airports.iata.json";
import pinned from "../data/airport-history/formal/airports.json";
import manifest from "../data/airport-history/formal/manifest.json";
import type { CompactAirportRow, FormalAssignment } from "../src";

type Runtime = typeof import("../src");
type Interval = Pick<FormalAssignment, "validFrom" | "validTo">;
const dayMs = 86_400_000;

async function loadWith(dataset: unknown): Promise<Runtime> {
  vi.resetModules();
  vi.doMock("../data/airport-history/formal/airports.json", () => ({
    default: dataset,
  }));
  const core = await import("../src");
  core.installAirportDirectory(airportRows as CompactAirportRow[]);
  return core;
}

afterEach(() => {
  vi.doUnmock("../data/airport-history/formal/airports.json");
  vi.resetModules();
});

function schemaFour() {
  const candidate = process.env.FLY_AIRPORT_HISTORY_SCHEMA_4_DATASET;
  if (candidate) return JSON.parse(readFileSync(candidate, "utf8"));
  // CI exercises the full pinned population offline. Local runs can supply
  // the exact proposed upstream bytes without changing the production pin.
  const plainFact = <T extends { sourceIds: string[] }>({
    sourceIds: _sourceIds,
    ...fact
  }: T) => fact;
  return {
    schemaVersion: "4.0.0",
    dataVersion: "0.14.0",
    airports: pinned.airports.map((airport) => ({
      ...airport,
      name: plainFact(airport.name),
      coordinates: plainFact(airport.coordinates),
      timezone: plainFact(airport.timezone),
    })),
    assignments: pinned.assignments.map(
      ({ sourceIds, verificationStatus, verifiedOn, evidenceType, ...row }) =>
        row,
    ),
    names: pinned.names.map(
      ({ sourceIds, verificationStatus, verifiedOn, evidenceType, ...row }) =>
        row,
    ),
  };
}

function sampleDates(rows: readonly Interval[]): string[] {
  const { fromInclusive, toExclusive } = manifest.queryHorizon;
  const boundaries = new Set([
    Date.parse(fromInclusive),
    Date.parse(toExclusive),
  ]);
  for (const row of rows) {
    for (const bound of [row.validFrom, row.validTo]) {
      if (bound.earliest) boundaries.add(Date.parse(bound.earliest));
      if (bound.latest) boundaries.add(Date.parse(bound.latest));
    }
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const samples = new Set<number>();
  for (const [index, boundary] of sorted.entries()) {
    samples
      .add(boundary - dayMs)
      .add(boundary)
      .add(boundary + dayMs);
    const next = sorted[index + 1];
    if (next !== undefined)
      samples.add(
        boundary + Math.floor((next - boundary) / (2 * dayMs)) * dayMs,
      );
  }
  return [...samples]
    .sort((a, b) => a - b)
    .map((value) => new Date(value).toISOString().slice(0, 10));
}

function resultOf(result: ReturnType<Runtime["resolveAirportAtDate"]>) {
  return {
    status: result.status,
    airportId: result.airportId,
    displayedAirportId: result.airport?.airportId ?? null,
    currentAirportId: result.currentDirectoryAirport?.airportId ?? null,
    candidates: result.uncertainty.possibleAirportIds,
    matches: result.formalMatches.map(({ assignment, relation }) => ({
      airportId: assignment.airportId,
      assignmentId: assignment.assignmentId,
      relation,
    })),
  };
}

it("preserves historical results and directory lookups across both formal schemas", async () => {
  expect(pinned.schemaVersion).toBe("3.0.0");
  const incoming = schemaFour();
  expect(incoming.schemaVersion).toBe("4.0.0");
  const before = await loadWith(pinned);
  const after = await loadWith(incoming);
  expect(after.airportHistoryDataVersion).toBe("0.14.0");

  const differences: unknown[] = [];
  const compare = (query: unknown, original: unknown, updated: unknown) => {
    if (!isDeepStrictEqual(original, updated))
      differences.push({ query, before: original, after: updated });
  };

  const codes = new Map(
    [...before.formalAssignments, ...after.formalAssignments].map(
      ({ code, scheme }) => [`${scheme}:${code}`, { code, scheme }],
    ),
  );
  let codeQueries = 0;
  for (const { code, scheme } of codes.values()) {
    const rows = [
      ...before.formalAssignmentsForCode(code, scheme),
      ...after.formalAssignmentsForCode(code, scheme),
    ];
    for (const date of sampleDates(rows)) {
      compare(
        { code, scheme, date },
        resultOf(before.resolveAirportAtDate(code, date, scheme)),
        resultOf(after.resolveAirportAtDate(code, date, scheme)),
      );
      codeQueries++;
    }
  }

  for (const [code, date] of [
    ["XQX", "2024-01-01"],
    ["HKG", "2024-02-30"],
  ]) {
    expect(before.resolveAirportAtDate(code!, date!).status).toBe(
      "unknown_code",
    );
    compare(
      { code, date },
      resultOf(before.resolveAirportAtDate(code!, date!)),
      resultOf(after.resolveAirportAtDate(code!, date!)),
    );
  }

  const namesById = new Map<string, Runtime["formalHistoricalNames"]>();
  for (const row of [
    ...before.formalHistoricalNames,
    ...after.formalHistoricalNames,
  ]) {
    const names = namesById.get(row.airportId) ?? [];
    names.push(row);
    namesById.set(row.airportId, names);
  }
  let nameQueries = 0;
  const ids = new Set([
    ...before.airportById.keys(),
    ...after.airportById.keys(),
  ]);
  for (const airportId of ids) {
    compare(
      { airportId },
      before.airportById.get(airportId),
      after.airportById.get(airportId),
    );
    const names = namesById.get(airportId) ?? [];
    const locales = new Set([
      "en",
      "zh-CN",
      ...names.map((row) => row.language),
    ]);
    for (const date of sampleDates(names)) {
      for (const locale of locales) {
        compare(
          { airportId, date, locale },
          before.localizedAirportName(airportId, locale, date),
          after.localizedAirportName(airportId, locale, date),
        );
        nameQueries++;
      }
    }
  }

  if (differences.length) throw new Error(JSON.stringify(differences, null, 2));
  console.info(
    `Zero differences across ${codeQueries} code/date pairs (${codes.size} codes) and ${nameQueries} localized name queries (${ids.size} site IDs and aliases).`,
  );
}, 60_000);

it("still excludes ineligible Schema 3.0.0 assignments and official names from certain results", async () => {
  const astana = "apt_99f19660-7609-49c5-b221-ed4a37046566";
  const oldName = "Международный аэропорт Астана";
  const original = await loadWith(pinned);
  expect(original.resolveAirportAtDate("TAO", "2021-08-12").status).toBe(
    "resolved",
  );
  expect(original.localizedAirportName(astana, "ru", "2015-01-01")).toBe(
    oldName,
  );

  const withPendingClaim = await loadWith({
    ...pinned,
    assignments: pinned.assignments.map((row) =>
      row.assignmentId === "iata-tao-jiaodong"
        ? { ...row, verificationStatus: "pending" }
        : row,
    ),
    names: pinned.names.map((row) =>
      row.nameId === "name-astana-before-2017"
        ? { ...row, verifiedOn: null }
        : row,
    ),
  });
  expect(
    withPendingClaim.resolveAirportAtDate("TAO", "2021-08-12"),
  ).toMatchObject({
    status: "uncertain",
    airportId: null,
    formalMatches: [{ relation: "certain" }],
  });
  expect(
    withPendingClaim.localizedAirportName(astana, "ru", "2015-01-01"),
  ).not.toBe(oldName);
});

it("rejects unknown future formal schemas", async () => {
  await expect(loadWith({ ...pinned, schemaVersion: "5.0.0" })).rejects.toThrow(
    "Unsupported Airport History schema: 5.0.0",
  );
});
