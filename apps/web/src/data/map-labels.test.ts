import { describe, expect, it } from "vitest";
import { airportLabelPositions } from "./map-labels";
import { WORLD_CAMERA } from "./map-camera";

describe("airport label placement", () => {
  it("keeps selected endpoints and prioritizes frequent airports with collision avoidance", () => {
    const points = Array.from({ length: 8 }, (_, index) => ({ iata: `A${index}`, point: { x: 480, y: 240 }, flightCount: index + 1 }));
    const labels = airportLabelPositions(points, WORLD_CAMERA, 480, new Set(["A0", "A1"]));
    expect(labels.has("A0")).toBe(true);
    expect(labels.has("A1")).toBe(true);
    expect(labels.has("A7")).toBe(true);
    expect(labels.size).toBe(4);
  });
  it("labels all well-separated regional airports", () => {
    const labels = airportLabelPositions([{ iata: "SZX", point: { x: 300, y: 300 }, flightCount: 1 }, { iata: "TAO", point: { x: 500, y: 100 }, flightCount: 1 }], WORLD_CAMERA, 480, new Set());
    expect([...labels.keys()].sort()).toEqual(["SZX", "TAO"]);
  });
});
