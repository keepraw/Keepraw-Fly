import { describe, expect, it } from "vitest";
import {
  formatRoute,
  isLandingFragment,
  parseRoute,
  primaryViewOrder,
  sameRoute,
  type Route,
} from "./routing";

describe("fragment routing", () => {
  it("opens the landing view for an empty fragment", () => {
    expect(parseRoute("")).toEqual({ view: "map" });
    expect(parseRoute("#")).toEqual({ view: "map" });
    expect(parseRoute("#/")).toEqual({ view: "map" });
    expect(parseRoute("", "log")).toEqual({ view: "log" });
  });

  it("tells an address that names no view from one that does", () => {
    for (const fragment of ["", "#", "#/", "#passport", "#flights", "#share"]) {
      expect(isLandingFragment(fragment)).toBe(true);
      expect(parseRoute(fragment, "passport")).toEqual({ view: "passport" });
    }
    for (const fragment of ["#/map", "#/log", "#settings", "#main-content"])
      expect(isLandingFragment(fragment)).toBe(false);
    expect(parseRoute("#/map", "log")).toEqual({ view: "map" });
  });

  it("keeps legacy fragments working", () => {
    for (const fragment of ["#passport", "#flights", "#share"])
      expect(parseRoute(fragment)).toEqual({ view: "map" });
    expect(parseRoute("#settings")).toEqual({ view: "settings" });
  });

  it("resolves every primary view", () => {
    for (const view of ["log", "map", "stats", "passport"] as const)
      expect(parseRoute(`#/${view}`)).toEqual({ view });
  });

  it("resolves settings parts and flights", () => {
    expect(parseRoute("#/settings")).toEqual({ view: "settings" });
    expect(parseRoute("#/settings/data")).toEqual({
      view: "settings",
      part: "data",
    });
    expect(parseRoute("#/flight/example-ua123-20260819")).toEqual({
      view: "flight",
      flightId: "example-ua123-20260819",
    });
  });

  it("round-trips flight ids that need encoding", () => {
    const route: Route = { view: "flight", flightId: "a/b c?#%20" };
    expect(parseRoute(formatRoute(route))).toEqual(route);
  });

  it("ignores a query after the path", () => {
    expect(parseRoute("#/log?year=2026")).toEqual({ view: "log" });
  });

  it("leaves unknown fragments alone", () => {
    for (const fragment of [
      "#main-content",
      "#/unknown",
      "#/flight",
      "#/flight/",
      "#/flight/a/b",
      "#/log/extra",
      "#/flight/%E0%A4%A",
    ])
      expect(parseRoute(fragment)).toBeNull();
  });

  it("formats canonical fragments", () => {
    expect(formatRoute({ view: "stats" })).toBe("#/stats");
    expect(formatRoute({ view: "settings" })).toBe("#/settings");
    expect(formatRoute({ view: "settings", part: "data" })).toBe(
      "#/settings/data",
    );
    expect(sameRoute({ view: "log" }, { view: "log" })).toBe(true);
    expect(sameRoute({ view: "log" }, { view: "map" })).toBe(false);
  });

  it("orders the primary destinations with the landing view first", () => {
    expect(primaryViewOrder()).toEqual(["map", "log", "stats", "passport"]);
    expect(primaryViewOrder("passport")).toEqual([
      "passport",
      "log",
      "map",
      "stats",
    ]);
  });
});
