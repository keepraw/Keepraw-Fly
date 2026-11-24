import { describe, expect, it } from "vitest";
import {
  formatExplorationQuery,
  parseExplorationQuery,
  type ExplorationQueryState,
} from "./exploration-query";

const defaults: ExplorationQueryState = {
  year: "lifetime",
  selection: null,
  airline: null,
  aircraft: null,
  sort: "newest",
};

describe("exploration state in the fragment query", () => {
  it("writes nothing for the default state", () => {
    expect(formatExplorationQuery(defaults)).toBe("");
    expect(parseExplorationQuery("#/log")).toBeNull();
    expect(parseExplorationQuery("#/log?")).toEqual(defaults);
  });

  it.each<[string, ExplorationQueryState]>([
    ["?year=2025", { ...defaults, year: 2025 }],
    [
      "?airline=CX&aircraft=Airbus%20A350-900&sort=longest",
      {
        ...defaults,
        airline: "CX",
        aircraft: "Airbus A350-900",
        sort: "longest",
      },
    ],
    [
      "?airport=SFO",
      { ...defaults, selection: { kind: "airport", code: "SFO" } },
    ],
    [
      "?year=2024&airport=SFO&at=current:SFO",
      {
        ...defaults,
        year: 2024,
        selection: {
          kind: "airport",
          code: "SFO",
          identityKey: "current:SFO",
        },
      },
    ],
    [
      "?route=LAX-SYD&from=current:LAX&to=airport:apt_syd",
      {
        ...defaults,
        selection: {
          kind: "route",
          origin: "LAX",
          destination: "SYD",
          originIdentityKey: "current:LAX",
          destinationIdentityKey: "airport:apt_syd",
        },
      },
    ],
    [
      "?route=LAX-SYD",
      {
        ...defaults,
        selection: { kind: "route", origin: "LAX", destination: "SYD" },
      },
    ],
  ])("round-trips %s", (query, state) => {
    expect(formatExplorationQuery(state)).toBe(query);
    expect(parseExplorationQuery(`#/stats${query}`)).toEqual(state);
  });

  it("never writes the search text", () => {
    const state = { ...defaults, year: 2026 as const, query: "secret" };
    expect(formatExplorationQuery(state)).toBe("?year=2026");
  });

  it("falls back to the defaults for malformed values", () => {
    expect(
      parseExplorationQuery(
        "#/log?year=20x6&airline=<b>&sort=random&airport=sfo&route=A-B-C&aircraft=",
      ),
    ).toEqual(defaults);
    expect(
      parseExplorationQuery("#/log?airport=SFO&at=bad key&unknown=1"),
    ).toEqual({ ...defaults, selection: { kind: "airport", code: "SFO" } });
  });

  it("round-trips an aircraft type exactly as recorded", () => {
    for (const aircraft of [
      " Boeing 787-9 ",
      `Airbus ${"A".repeat(60)}`,
      "A+B&C=D",
    ])
      expect(
        parseExplorationQuery(
          `#/log${formatExplorationQuery({ ...defaults, aircraft })}`,
        ),
      ).toEqual({ ...defaults, aircraft });
  });
});
