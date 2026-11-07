/**
 * Real-data tests: every assertion runs against the committed airport-history
 * package generated from keepraw/airport-history 7d21ff67 (no mocks).
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import airportRows from "../data/airports.iata.json";
import manifest from "../data/airport-history/manifest.json";
import formal from "../data/airport-history/formal/airports.json";
import {
  airportByIata,
  airportHistoryShard,
  arrivalIdentity,
  buildRouteSegments,
  buildUncertainAirportMarkers,
  calculatePassportStatistics,
  calculateYearStatistics,
  createAirportHistoryLoader,
  distanceForFlight,
  ensureAirportHistoryCodes,
  ensureAirportHistorySearchIndex,
  installAirportDirectory,
  originIdentity,
  resetAirportHistoryCandidates,
  resolveAirportAtDate,
  searchHistoricalAirports,
  sha256Hex,
  type CompactAirportRow,
} from "../src";

const root = fileURLToPath(
  new URL("../data/airport-history/", import.meta.url),
);
const loader = createAirportHistoryLoader((path) => readFile(root + path));
function airportIdByName(name: string): string {
  const match = formal.airports.find((airport) => airport.name.value === name);
  if (!match) throw new Error(name);
  return match.airportId;
}

function flight(
  origin: string,
  destination: string,
  serviceDate: string,
  scheduledDeparture: string,
  scheduledArrival: string,
  extra: Partial<KeeprawFlight> = {},
): KeeprawFlight {
  return {
    id: `f-${origin}-${destination}-${serviceDate}`,
    flightNumber: "CX100",
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture,
    scheduledArrival,
    ...extra,
  };
}

beforeAll(async () => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
  resetAirportHistoryCandidates();
  await ensureAirportHistoryCodes(
    loader,
    [
      "TAO",
      "IST",
      "ISL",
      "HKG",
      "KTI",
      "ABN",
      "AUS",
      "QQQ",
      "PEK",
      "SFO",
      "ADD",
      "JNB",
      "CTU",
      "KMG",
    ].map((code) => ({ code })),
  );
  await ensureAirportHistoryCodes(loader, [{ code: "VHHH", scheme: "ICAO" }]);
  await ensureAirportHistorySearchIndex(loader);
}, 120_000);

describe("formal historical resolution (pinned upstream data)", () => {
  it.each([
    ["TAO", "2018-06-01", "Qingdao Liuting International Airport"],
    ["TAO", "2022-06-01", "Qingdao Jiaodong International Airport"],
    ["IST", "2018-06-01", "İstanbul Atatürk Airport"],
    ["IST", "2020-06-01", "İstanbul Airport"],
    ["HKG", "1997-06-01", "Hong Kong International Airport Kai Tak"],
    ["HKG", "1999-06-01", "Hong Kong International Airport"],
  ])("%s on %s resolves to %s", (code, date, name) => {
    const result = resolveAirportAtDate(code, date);
    expect(result.status).toBe("resolved");
    expect(result.airport?.name).toBe(name);
    expect(result.airportId).toBe(airportIdByName(name));
    expect(result.matchedAssignment?.code).toBe(code);
    expect(result.dataVersion).toBe(manifest.dataVersion);
  });

  it("resolves ICAO VHHH by date too", () => {
    expect(
      resolveAirportAtDate("VHHH", "1997-01-01", "ICAO").airport?.name,
    ).toBe("Hong Kong International Airport Kai Tak");
    expect(
      resolveAirportAtDate("VHHH", "2001-01-01", "ICAO").airport?.name,
    ).toBe("Hong Kong International Airport");
  });

  it("keeps the date inside an uncertain boundary uncertain (IST cut-over day)", () => {
    const result = resolveAirportAtDate("IST", "2019-04-06");
    expect(result.status).toBe("uncertain");
    expect(result.airportId).toBeNull();
    expect(result.uncertainty.reason).toBe("date_in_uncertain_boundary");
    expect(result.uncertainty.possibleAirportIds).toHaveLength(2);
    // The current directory has IST, but it must not mask formal uncertainty.
    expect(result.currentDirectoryAirport?.iata).toBe("IST");
    expect(result.airport).toBeNull();
  });

  it("never turns an unknown-precision start into an exact date (HKG before 1993-11-05)", () => {
    const result = resolveAirportAtDate("HKG", "1980-01-01");
    expect(result.status).toBe("uncertain");
    const kaiTak = result.uncertainty.assignments[0]!;
    expect(kaiTak.validFrom).toEqual({
      earliest: null,
      latest: "1993-11-05",
      precision: "unknown",
    });
  });

  it("does not read `verified` as every day being certain (open horizon after review)", () => {
    const result = resolveAirportAtDate("TAO", "2026-11-01");
    expect(result.status).toBe("uncertain");
    expect(result.matchedAssignment).toBeNull();
  });

  it("KTI with only an evidence bound is never `resolved`", () => {
    const result = resolveAirportAtDate("KTI", "2020-01-01");
    expect(result.status).not.toBe("resolved");
    expect(result.status).toBe("uncertain");
    expect(result.airportId).toBeNull();
  });

  it("keeps historical and current names and coordinates distinct", () => {
    const kaiTak = resolveAirportAtDate("HKG", "1997-06-01").airport!;
    const current = resolveAirportAtDate("HKG", "1999-06-01").airport!;
    expect(kaiTak.name).not.toBe(current.name);
    expect(
      Math.abs(kaiTak.latitude - current.latitude) +
        Math.abs(kaiTak.longitude - current.longitude),
    ).toBeGreaterThan(0.1);
    const hkgOrigin = originIdentity(
      flight(
        "HKG",
        "SFO",
        "1997-06-01",
        "1997-06-01T10:00:00+08:00",
        "1997-06-01T08:00:00-07:00",
      ),
    );
    expect(hkgOrigin.differsFromCurrentDirectory).toBe(true);
    expect(hkgOrigin.name?.en).toBe("Hong Kong International Airport Kai Tak");
  });
});

describe("worldwide candidate layer (88,330 groups / 117,356 candidates)", () => {
  it("returns historical_candidate for a code with no formal assignment and no current directory entry", () => {
    const result = resolveAirportAtDate("ABN", "2010-01-01");
    expect(result.status).toBe("historical_candidate");
    expect(result.airportId).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
    const lead = result.candidates[0]!;
    expect(lead.eventGroupId).toMatch(/^(lead|dup)_/);
    expect(lead.candidateId).toMatch(/^cand_/);
    expect(lead.sourceRevisions[0]?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.candidateSites[0]?.name).toBe("Albina Airport");
    expect(result.candidateSites[0]?.timezone).toBe("America/Paramaribo");
    expect(result.candidateSources.length).toBeGreaterThan(0);
    expect(
      result.observationTimestamps.every(
        (t) => t.meaning === "directory_revision_observed",
      ),
    ).toBe(true);
  });

  it("never upgrades candidates to an airportId, whatever the date", () => {
    for (const date of ["1950-01-01", "2024-10-01", "2026-01-01"])
      expect(resolveAirportAtDate("ABN", date).airportId).toBeNull();
  });

  it("keeps distinct physical sites for one code apart (AUS: Mueller and Bergstrom)", () => {
    const result = resolveAirportAtDate("AUS", "1995-01-01");
    expect(result.status).toBe("historical_candidate");
    const names = new Set([
      ...result.candidateSites.map((s) => s.name),
      ...result.candidates.flatMap((c) => c.possibleSites.map((s) => s.name)),
    ]);
    expect(names).toContain("Austin Robert Mueller Municipal Airport");
    expect(names).toContain("Austin Bergstrom International Airport");
    const ids = new Set(result.candidateSites.map((s) => s.siteId));
    expect(ids.size).toBeGreaterThan(1);
  });

  it("returns unknown_code when neither layer nor the directory knows the code", () => {
    const result = resolveAirportAtDate("QQQ", "2010-01-01");
    expect(result.status).toBe("unknown_code");
    expect(result.candidates).toEqual([]);
  });

  it("reports candidate_index_unavailable, not unknown, before shards load", () => {
    expect(resolveAirportAtDate("ZZV", "2010-01-01").status).toBe(
      "candidate_index_unavailable",
    );
    // Formal resolution keeps working without any candidate shard.
    expect(resolveAirportAtDate("HKG", "1997-06-01").status).toBe("resolved");
  });

  it("uses the current directory only when every candidate site is that site", () => {
    const result = resolveAirportAtDate("SFO", "2010-01-01");
    expect(result.status).toBe("current_directory_only");
    expect(result.airportId).toBeNull();
    expect(result.airport?.basis).toBe("current_directory");
  });

  it("searches historical names, historical codes and candidate sites", () => {
    expect(
      searchHistoricalAirports("Kai Tak").some((r) => r.kind === "formal"),
    ).toBe(true);
    expect(
      searchHistoricalAirports("ISL").some(
        (r) => r.kind === "formal" && r.name === "İstanbul Atatürk Airport",
      ),
    ).toBe(true);
    expect(
      searchHistoricalAirports("Mueller", 20).some(
        (r) => r.kind === "candidate" && r.code === "AUS",
      ),
    ).toBe(true);
    expect(
      searchHistoricalAirports("ABN").some(
        (r) => r.kind === "candidate" && r.name === "Albina Airport",
      ),
    ).toBe(true);
  });
});

describe("statistics, routes and distance use physical identities", () => {
  const kaiTak = flight(
    "HKG",
    "SFO",
    "1997-06-01",
    "1997-06-01T10:00:00+08:00",
    "1997-06-01T08:00:00-07:00",
  );
  const chekLapKok = flight(
    "HKG",
    "SFO",
    "2005-06-01",
    "2005-06-01T10:00:00+08:00",
    "2005-06-01T08:00:00-07:00",
  );
  const candidate = flight(
    "ABN",
    "SFO",
    "2010-06-01",
    "2010-06-01T10:00:00-03:00",
    "2010-06-01T20:00:00-07:00",
  );

  it("does not merge two physical airports that shared HKG", () => {
    const stats = calculatePassportStatistics([kaiTak, chekLapKok]);
    expect(stats.airports).toBe(3);
    expect(originIdentity(kaiTak).identityKey).not.toBe(
      originIdentity(chekLapKok).identityKey,
    );
    expect(
      calculateYearStatistics([kaiTak, chekLapKok]).map((y) => y.airports),
    ).toEqual([2, 2]);
  });

  it("does not count a historical candidate as a visited airport", () => {
    const stats = calculatePassportStatistics([candidate]);
    expect(stats.airports).toBe(1);
    expect(stats.unresolvedAirports).toBe(1);
    expect(stats.currentDirectoryAirports).toBe(1);
  });

  it("measures distance from the historical site, never from candidates", () => {
    const kaiTakKm = distanceForFlight(kaiTak)!;
    const cheKm = distanceForFlight(chekLapKok)!;
    expect(kaiTakKm).not.toBeCloseTo(cheKm, 0);
    expect(distanceForFlight(candidate)).toBeNull();
  });

  it("draws routes only between confirmed airports and marks candidates as possible", () => {
    const routes = buildRouteSegments([kaiTak, chekLapKok, candidate]);
    expect(routes).toHaveLength(2);
    expect(routes.map((r) => r.origin.identityKey)).toEqual([
      originIdentity(kaiTak).identityKey,
      originIdentity(chekLapKok).identityKey,
    ]);
    const markers = buildUncertainAirportMarkers([candidate]);
    expect(markers.map((m) => m.name)).toContain("Albina Airport");
    expect(markers.every((m) => m.source === "historical_candidate")).toBe(
      true,
    );
  });

  it("dates the arrival in the historical destination zone, not by serviceDate", () => {
    // Departs HKG 1998-07-05 23:30 local; arrives SFO 1998-07-05 local.
    // The destination (SFO) is current-directory; the date comes from the instant.
    const late = flight(
      "SFO",
      "HKG",
      "1998-07-05",
      "1998-07-05T13:00:00-07:00",
      "1998-07-06T17:30:00+08:00",
    );
    expect(arrivalIdentity(late).localDate).toBe("1998-07-06");
    expect(arrivalIdentity(late).status).toBe("uncertain");
    const after = flight(
      "SFO",
      "HKG",
      "1998-07-06",
      "1998-07-06T13:00:00-07:00",
      "1998-07-07T17:30:00+08:00",
    );
    expect(arrivalIdentity(after).localDate).toBe("1998-07-07");
    expect(arrivalIdentity(after).status).toBe("resolved");
    expect(arrivalIdentity(after).name?.en).toBe(
      "Hong Kong International Airport",
    );
  });
});

describe("current-directory agreement and disagreement (real data)", () => {
  it("keeps the formal identity but the directory's own point for the identical site", () => {
    const identity = originIdentity(
      flight(
        "HKG",
        "SFO",
        "2025-06-01",
        "2025-06-01T10:00:00+08:00",
        "2025-06-01T23:00:00+08:00",
      ),
    );
    const formalSite = resolveAirportAtDate("HKG", "2025-06-01").airport!;
    const directory = airportByIata.get("HKG")!;
    expect(identity.identityKey).toBe(`airport:${formalSite.airportId}`);
    expect(identity.basis).toBe("formal");
    expect(identity.point).toEqual({
      latitude: directory.latitude,
      longitude: directory.longitude,
    });
    // Kai Tak is a distinct site: it keeps its own formal coordinates.
    const kaiTak = resolveAirportAtDate("HKG", "1997-06-01").airport!;
    expect(
      originIdentity(
        flight(
          "HKG",
          "SFO",
          "1997-06-01",
          "1997-06-01T10:00:00+08:00",
          "1997-06-01T23:00:00+08:00",
        ),
      ).point,
    ).toEqual({ latitude: kaiTak.latitude, longitude: kaiTak.longitude });
  });

  it("uses a candidate zone only when every candidate and the directory agree (JNB)", () => {
    const et809 = flight(
      "ADD",
      "JNB",
      "2026-09-12",
      "2026-09-12T10:20:00+08:00",
      "2026-09-12T13:05:00+08:00",
    );
    const arrival = arrivalIdentity(et809);
    // One reference row places JNB ~220 km away: the site stays unconfirmed...
    expect(arrival.status).toBe("historical_candidate");
    expect(arrival.confirmed).toBe(false);
    expect(arrival.point).toBeNull();
    expect(distanceForFlight(et809)).toBeNull();
    // ...but every hypothesis shares the directory's zone, so local time is known.
    expect(arrival.timezoneOptions).toEqual(["Africa/Johannesburg"]);
    expect(arrival.timezone).toBe("Africa/Johannesburg");
    expect(arrival.localDate).toBe("2026-09-12");
  });

  it("never draws a stale directory site the reference layer contradicts (KMG)", () => {
    const kunming = flight(
      "CTU",
      "KMG",
      "2026-09-22",
      "2026-09-22T10:00:00+08:00",
      "2026-09-22T11:30:00+08:00",
    );
    const arrival = arrivalIdentity(kunming);
    expect(arrival.status).toBe("historical_candidate");
    expect(arrival.confirmed).toBe(false);
    expect(arrival.timezone).toBeNull();
    expect(buildRouteSegments([kunming])).toHaveLength(0);
    expect(
      buildUncertainAirportMarkers([kunming]).map((m) => m.name),
    ).toContain("Kunming Changshui International Airport");
  });
});

describe("package integrity", () => {
  it("matches the upstream counts", () => {
    expect(manifest.counts).toMatchObject({
      formalAirports: 43,
      formalAssignments: 52,
      formalSources: 106,
      referenceRecords: 86950,
      eventGroups: 88330,
      selectedCandidates: 117356,
      codeChangeObservations: 68012,
      geographicallyDistinctCodeLeads: 493,
    });
  });

  it(
    "every committed file matches its manifest SHA-256 and record count",
    { timeout: 300_000 },
    async () => {
      let groups = 0;
      let candidates = 0;
      let records = 0;
      for (const [path, entry] of Object.entries(manifest.files)) {
        const bytes = await readFile(root + path);
        expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(
          entry.sha256,
        );
        expect(bytes.length).toBe(entry.bytes);
        if (path.endsWith(".gz")) {
          const lines = gunzipSync(bytes)
            .toString("utf8")
            .split("\n")
            .filter(Boolean);
          expect(lines.length, path).toBe(entry.records);
          if (path.startsWith("transitions/groups.")) {
            groups += lines.length;
            for (const line of lines)
              candidates += (JSON.parse(line) as { members: unknown[] }).members
                .length;
          }
          if (path.startsWith("observations/records.")) records += lines.length;
        }
      }
      expect(groups).toBe(88330);
      expect(candidates).toBe(117356);
      expect(records).toBe(86950);
    },
  );

  it("shards codes exactly like the Python builder", () => {
    expect(sha256Hex("")).toBe(createHash("sha256").update("").digest("hex"));
    expect(sha256Hex("IATA:TAO")).toBe(
      createHash("sha256").update("IATA:TAO").digest("hex"),
    );
    expect(airportHistoryShard("IATA:HKG")).toBe(
      createHash("sha256").update("IATA:HKG").digest("hex")[0],
    );
  });
});
