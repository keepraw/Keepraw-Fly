import { describe, expect, it } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  airports,
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import { createUmetripAirportResolver } from "./umetrip-airports";

installAirportDirectory(airportRows as CompactAirportRow[]);
describe("Umetrip exact airport names", () => {
  it.each([
    ["青岛流亭", "TAO"],
    ["青岛胶东", "TAO"],
    ["青岛胶东国际机场", "TAO"],
    ["孟买贾特拉帕蒂希瓦吉", "BOM"],
    ["苏加诺哈达", "CGK"],
    ["苏加诺－哈达国际机场", "CGK"],
    ["蘇加諾－哈達國際機場", "CGK"],
    ["北京首都", "PEK"],
    ["上海虹桥", "SHA"],
    [" sha ", "SHA"],
  ])("resolves %s to the directory IATA %s", (raw, iata) => {
    expect(createUmetripAirportResolver()(raw)).toEqual({ iata });
  });
  it.each([
    "北京",
    "上海",
    "London",
    "虹桥附近",
    "上海虹桥（PVG）",
    "未知机场",
    "ZZZ",
    "",
  ])("does not guess from cities or substrings: %s", (raw) => {
    expect(createUmetripAirportResolver()(raw)).toEqual({
      code: "unknown-airport",
    });
  });
  it("reports a collision rather than picking the first matching name", () => {
    const synthetic = {
      ...airports[0]!,
      iata: "ZZZ",
      name: { en: "北京首都机场" },
    };
    airports.push(synthetic);
    try {
      expect(createUmetripAirportResolver()("北京首都")).toEqual({
        code: "ambiguous-airport",
      });
    } finally {
      airports.pop();
    }
  });
});
