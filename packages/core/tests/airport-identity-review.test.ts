/**
 * Physical identity in selection, assignment evidence and candidate/directory
 * consistency — all against the committed airport-history package generated
 * from keepraw/airport-history 19b7b1de (no mocked airport identities).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import airportRows from "../data/airports.iata.json";
import formal from "../data/airport-history/formal/airports.json";
import {
  airportByIata,
  airportSelectionTarget,
  arrivalIdentity,
  buildRouteSegments,
  calculatePassportStatistics,
  candidateHasPhysicalSiteMeaning,
  candidateSitesMatchCurrentDirectory,
  createAirportHistoryLoader,
  ensureAirportHistoryCodes,
  flightMatchesAirportTarget,
  flightMatchesRouteTarget,
  flightRouteIdentityKey,
  flightRouteTarget,
  installAirportDirectory,
  originIdentity,
  resetAirportHistoryCandidates,
  resolveAirportAtDate,
  routeIdentityKey,
  routeSelectionTarget,
  routeTargetMatches,
  type CandidateSite,
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
  id: string,
  origin: string,
  destination: string,
  serviceDate: string,
  scheduledDeparture: string,
  scheduledArrival: string,
): KeeprawFlight {
  return {
    id,
    flightNumber: "CX100",
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture,
    scheduledArrival,
  };
}

// HKG was Kai Tak in 1997 and Chek Lap Kok in 1999 (formal layer).
const kaiTakOut = flight(
  "kai-tak-out",
  "HKG",
  "SFO",
  "1997-06-01",
  "1997-06-01T10:00:00+08:00",
  "1997-06-01T23:00:00+08:00",
);
const chekLapKokOut = flight(
  "chek-lap-kok-out",
  "HKG",
  "SFO",
  "1999-06-01",
  "1999-06-01T10:00:00+08:00",
  "1999-06-01T23:00:00+08:00",
);
// The same code as a destination: a different route context.
const kaiTakIn = flight(
  "kai-tak-in",
  "SFO",
  "HKG",
  "1997-05-01",
  "1997-05-01T09:00:00-07:00",
  "1997-05-02T16:00:00+08:00",
);
const chekLapKokIn = flight(
  "chek-lap-kok-in",
  "SFO",
  "HKG",
  "1999-05-01",
  "1999-05-01T09:00:00-07:00",
  "1999-05-02T16:00:00+08:00",
);
const all = [kaiTakOut, chekLapKokOut, kaiTakIn, chekLapKokIn];

beforeAll(async () => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
  resetAirportHistoryCandidates();
  await ensureAirportHistoryCodes(
    loader,
    ["HKG", "SFO", "TAO", "IST", "PEK", "CAN", "JNB", "KMG", "ADD"].map(
      (code) => ({ code }),
    ),
  );
}, 120_000);

describe("selection by physical identity (HKG: Kai Tak vs Chek Lap Kok)", () => {
  const kaiTakKey = `airport:${airportIdByName("Hong Kong International Airport Kai Tak")}`;
  const chekLapKokKey = `airport:${airportIdByName("Hong Kong International Airport")}`;

  it("gives the two HKG sites different identity keys", () => {
    expect(originIdentity(kaiTakOut).identityKey).toBe(kaiTakKey);
    expect(originIdentity(chekLapKokOut).identityKey).toBe(chekLapKokKey);
    expect(arrivalIdentity(kaiTakIn).identityKey).toBe(kaiTakKey);
    expect(arrivalIdentity(chekLapKokIn).identityKey).toBe(chekLapKokKey);
    expect(kaiTakKey).not.toBe(chekLapKokKey);
  });

  it("selects only the flights that used the selected site", () => {
    const kaiTak = airportSelectionTarget(originIdentity(kaiTakOut));
    expect(kaiTak).toEqual({
      kind: "airport",
      code: "HKG",
      identityKey: kaiTakKey,
    });
    expect(
      all.filter((f) => flightMatchesAirportTarget(f, kaiTak)).map((f) => f.id),
    ).toEqual(["kai-tak-out", "kai-tak-in"]);
    const chekLapKok = airportSelectionTarget(originIdentity(chekLapKokOut));
    expect(
      all
        .filter((f) => flightMatchesAirportTarget(f, chekLapKok))
        .map((f) => f.id),
    ).toEqual(["chek-lap-kok-out", "chek-lap-kok-in"]);
  });

  it("keeps a legacy code-only selection working by code", () => {
    expect(
      all.filter((f) => flightMatchesAirportTarget(f, { code: "HKG" })),
    ).toHaveLength(4);
  });

  it("never combines two routes that only share codes", () => {
    const routes = buildRouteSegments(all);
    expect(routes).toHaveLength(4);
    expect(new Set(routes.map(routeIdentityKey)).size).toBe(4);
    const kaiTakRoute = routes.find((r) =>
      routeTargetMatches(flightRouteTarget(kaiTakOut), r),
    )!;
    expect(kaiTakRoute.origin.identityKey).toBe(kaiTakKey);
    expect(kaiTakRoute.flightCount).toBe(1);
    const target = routeSelectionTarget(kaiTakRoute);
    expect(target.originIdentityKey).toBe(kaiTakKey);
    expect(target.destinationIdentityKey).toBe(
      originIdentity(kaiTakIn).identityKey,
    );
    expect(
      all.filter((f) => flightMatchesRouteTarget(f, target)).map((f) => f.id),
    ).toEqual(["kai-tak-out"]);
    // Highlight keys are physical too: same codes, different keys.
    expect(flightRouteIdentityKey(kaiTakOut)).not.toBe(
      flightRouteIdentityKey(chekLapKokOut),
    );
    expect(flightRouteIdentityKey(kaiTakIn)).not.toBe(
      flightRouteIdentityKey(chekLapKokIn),
    );
    // A legacy code-pair selection still matches both HKG→SFO routes.
    expect(
      all.filter((f) =>
        flightMatchesRouteTarget(f, { origin: "HKG", destination: "SFO" }),
      ),
    ).toHaveLength(2);
  });
});

describe("historical assignment evidence", () => {
  it("marks formal resolved assignments as historically verified", () => {
    for (const record of [kaiTakOut, chekLapKokOut]) {
      const identity = originIdentity(record);
      expect(identity.status).toBe("resolved");
      expect(identity.historicalAssignmentVerified).toBe(true);
      expect(identity.assignmentEvidence).toBe("historically_verified");
    }
  });

  it("never marks a current-directory match as historically verified", () => {
    const sfo = arrivalIdentity(kaiTakOut);
    expect(sfo.status).toBe("current_directory_only");
    expect(sfo.confirmed).toBe(true);
    expect(sfo.identityKey).toBe("current:SFO");
    expect(sfo.historicalAssignmentVerified).toBe(false);
    expect(sfo.assignmentEvidence).toBe("current_directory");
  });

  it("keeps uncertain formal dates and candidates unverified", () => {
    const istCutOver = originIdentity(
      flight(
        "ist",
        "IST",
        "SFO",
        "2019-04-06",
        "2019-04-06T10:00:00+03:00",
        "2019-04-06T20:00:00-07:00",
      ),
    );
    expect(istCutOver.assignmentEvidence).toBe("formal_uncertain");
    expect(istCutOver.historicalAssignmentVerified).toBe(false);
    const kmg = arrivalIdentity(
      flight(
        "kmg",
        "PEK",
        "KMG",
        "2026-09-22",
        "2026-09-22T10:00:00+08:00",
        "2026-09-22T13:30:00+08:00",
      ),
    );
    expect(kmg.assignmentEvidence).toBe("historical_candidate");
    const unknown = originIdentity(
      flight(
        "qqq",
        "QQQ",
        "SFO",
        "2010-06-01",
        "2010-06-01T10:00:00+08:00",
        "2010-06-02T09:00:00+08:00",
      ),
    );
    expect(unknown.assignmentEvidence).toBe("unknown");
  });

  it("keeps existing formal results (HKG, TAO, IST) unchanged", () => {
    expect(resolveAirportAtDate("HKG", "1997-06-01").airport?.name).toBe(
      "Hong Kong International Airport Kai Tak",
    );
    expect(resolveAirportAtDate("HKG", "1999-06-01").airport?.name).toBe(
      "Hong Kong International Airport",
    );
    expect(resolveAirportAtDate("TAO", "2018-06-01").airport?.name).toBe(
      "Qingdao Liuting International Airport",
    );
    expect(resolveAirportAtDate("TAO", "2022-06-01").airport?.name).toBe(
      "Qingdao Jiaodong International Airport",
    );
    expect(resolveAirportAtDate("IST", "2018-06-01").airport?.name).toBe(
      "İstanbul Atatürk Airport",
    );
    expect(resolveAirportAtDate("IST", "2020-06-01").airport?.name).toBe(
      "İstanbul Airport",
    );
  });

  it("counts verified and current-directory airports separately", () => {
    const stats = calculatePassportStatistics(all);
    // Kai Tak + Chek Lap Kok verified; SFO rests on the current directory.
    expect(stats.airports).toBe(3);
    expect(stats.historicallyVerifiedAirports).toBe(2);
    expect(stats.currentDirectoryAirports).toBe(1);
    expect(stats.formalUncertainAirports).toBe(0);
  });
});

describe("candidate sites vs the current directory (no position ignored)", () => {
  // Real CAN reference hypothesis, which matches the directory's own site.
  let site: CandidateSite;
  let directory: { latitude: number; longitude: number };
  beforeAll(() => {
    const resolution = resolveAirportAtDate("CAN", "2024-06-01");
    expect(resolution.status).toBe("current_directory_only");
    site = resolution.candidateSites[0]!;
    directory = airportByIata.get("CAN")!;
  });
  const variant = (patch: Partial<CandidateSite>): CandidateSite => ({
    ...site,
    siteId: `${site.siteId}-variant`,
    ...patch,
  });

  it("is true only when every site has a valid position at the directory site", () => {
    expect(site.ambiguousLocation).toBe(false);
    expect(candidateSitesMatchCurrentDirectory(directory, [site], [])).toBe(
      true,
    );
  });

  it("is false when another site has no coordinates", () => {
    for (const missing of [
      { latitude: null },
      { longitude: null },
      { latitude: null, longitude: null },
    ])
      expect(
        candidateSitesMatchCurrentDirectory(
          directory,
          [site, variant(missing)],
          [],
        ),
      ).toBe(false);
  });

  it("is false when a site has invalid coordinates", () => {
    for (const invalid of [
      { latitude: Number.NaN },
      { longitude: Number.POSITIVE_INFINITY },
      { latitude: 123 },
      { longitude: -200 },
    ])
      expect(
        candidateSitesMatchCurrentDirectory(
          directory,
          [site, variant(invalid)],
          [],
        ),
      ).toBe(false);
  });

  it("is false when a site is an ambiguous location", () => {
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site, variant({ ambiguousLocation: true })],
        [],
      ),
    ).toBe(false);
  });

  it("is false when a site lies more than 10 km away", () => {
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site, variant({ latitude: site.latitude! + 0.1 })],
        [],
      ),
    ).toBe(false);
  });

  it("checks every candidate's possible sites too", () => {
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [
          {
            possibleSites: [
              { ...variant({ latitude: null }), linkedByCandidate: true },
            ],
          },
        ],
      ),
    ).toBe(false);
  });

  it("keeps the real JNB and KMG answers", () => {
    // JNB: ambiguous reference rows, one ~220 km away.
    const jnb = resolveAirportAtDate("JNB", "2026-09-12");
    expect(jnb.status).toBe("historical_candidate");
    expect(jnb.uncertainty.candidateSitesMatchCurrentDirectory).toBe(false);
    expect(jnb.candidateSites).toHaveLength(3);
    expect(jnb.candidates).toHaveLength(4);
    // KMG: the only reference site is Changshui, 23 km from the directory row.
    const kmg = resolveAirportAtDate("KMG", "2026-09-22");
    expect(kmg.status).toBe("historical_candidate");
    expect(kmg.candidateSites.map((s) => s.name)).toEqual([
      "Kunming Changshui International Airport",
    ]);
  });
});

describe("pure code events vs real physical-site hypotheses", () => {
  beforeAll(async () => {
    await ensureAirportHistoryCodes(
      loader,
      ["SSM", "VLO", "CDT"].map((code) => ({ code })),
    );
  }, 120_000);

  it("falls back to the directory itself for codes with only pure code events (SSM)", () => {
    for (const date of ["1990-06-01", "2026-06-01"]) {
      const ssm = resolveAirportAtDate("SSM", date);
      // Nothing verified a same-site match; the directory is the basis.
      expect(ssm.status).toBe("current_directory_only");
      expect(ssm.uncertainty.candidateSitesMatchCurrentDirectory).toBeNull();
      expect(ssm.airportId).toBeNull();
      expect(ssm.matchedAssignment).toBeNull();
      expect(ssm.airport?.basis).toBe("current_directory");
      // The code events stay attached with their sources and observation
      // times, which never act as effective dates.
      expect(ssm.candidates.length).toBeGreaterThan(0);
      for (const candidate of ssm.candidates) {
        expect(candidate.possibleSites).toEqual([]);
        expect(candidate.types).toContain("iata_change");
        expect(candidateHasPhysicalSiteMeaning(candidate)).toBe(false);
        expect(candidate.sourceId).toBeTruthy();
      }
      expect(ssm.observationTimestamps.length).toBeGreaterThan(0);
      expect(
        ssm.observationTimestamps.every(
          (t) => t.meaning === "directory_revision_observed",
        ),
      ).toBe(true);
      expect(
        candidateSitesMatchCurrentDirectory(
          airportByIata.get("SSM")!,
          ssm.candidateSites,
          ssm.candidates,
        ),
      ).toBeNull();
    }
    const flightDate = originIdentity(
      flight(
        "ssm",
        "SSM",
        "SFO",
        "2026-06-01",
        "2026-06-01T10:00:00-04:00",
        "2026-06-01T14:00:00-07:00",
      ),
    );
    expect(flightDate.confirmed).toBe(true);
    expect(flightDate.basis).toBe("current_directory");
    expect(flightDate.assignmentEvidence).toBe("current_directory");
    expect(flightDate.historicalAssignmentVerified).toBe(false);
  });

  it("treats a site-less relocation as a physical hypothesis that blocks the same-site match (VLO, CDT)", () => {
    for (const code of ["VLO", "CDT"]) {
      const result = resolveAirportAtDate(code, "2024-06-01");
      expect(result.status).toBe("historical_candidate");
      expect(result.uncertainty.candidateSitesMatchCurrentDirectory).toBe(
        false,
      );
      const relocation = result.candidates.find(
        (candidate) =>
          candidate.memberClassification ===
            "location_change_or_directory_correction" &&
          candidate.possibleSites.length === 0,
      )!;
      expect(relocation.types).toContain("possible_relocation");
      expect(candidateHasPhysicalSiteMeaning(relocation)).toBe(true);
      // The named coordinates are preserved verbatim.
      expect(relocation.changes.lat).toHaveLength(2);
      expect(relocation.changes.lon).toHaveLength(2);
    }
  });

  it("separates pure code events from relocations with missing, invalid or near coordinates", () => {
    const can = resolveAirportAtDate("CAN", "2024-06-01");
    const site = can.candidateSites[0]!;
    const directory = airportByIata.get("CAN")!;
    const pureCode = resolveAirportAtDate("SSM", "2024-06-01").candidates[0]!;
    const relocation = resolveAirportAtDate(
      "VLO",
      "2024-06-01",
    ).candidates.find(
      (candidate) =>
        candidate.possibleSites.length === 0 &&
        candidate.types.includes("possible_relocation"),
    )!;
    const at = (lat: string | null, lon: string | null) => ({
      ...relocation,
      changes: {
        ...relocation.changes,
        lat: [lat, lat] as [string | null, string | null],
        lon: [lon, lon] as [string | null, string | null],
      },
    });
    // A pure code event proposes no position and never blocks a real match.
    expect(
      candidateSitesMatchCurrentDirectory(directory, [site], [pureCode]),
    ).toBe(true);
    // Only pure code events: nothing to verify, never a claimed match.
    expect(
      candidateSitesMatchCurrentDirectory(directory, [], [pureCode]),
    ).toBeNull();
    // A relocation without any coordinates is a missing position.
    const { lat: _lat, lon: _lon, ...withoutCoordinates } = relocation.changes;
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [{ ...relocation, changes: withoutCoordinates }],
      ),
    ).toBe(false);
    // Invalid coordinates block.
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [at("north", "east")],
      ),
    ).toBe(false);
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [at(String(directory.latitude), null)],
      ),
    ).toBe(false);
    // Named coordinates more than 10 km away block; at the site they agree.
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [at(String(directory.latitude + 0.2), String(directory.longitude))],
      ),
    ).toBe(false);
    expect(
      candidateSitesMatchCurrentDirectory(
        directory,
        [site],
        [at(String(directory.latitude), String(directory.longitude))],
      ),
    ).toBe(true);
    // Upstream's relocation classification alone (no sites, no coordinates)
    // is still a physical claim, never a code-only event.
    expect(
      candidateHasPhysicalSiteMeaning({
        possibleSites: [],
        memberClassification: "location_change_or_directory_correction",
        types: ["iata_change"],
        changes: { iata: ["AAA", "BBB"] },
      }),
    ).toBe(true);
  });
});
