import { describe, expect, it } from "vitest";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { buildShareRenderModel } from "./share-model";
import {
  FIXED_OVERVIEW_CAMERA,
  MAX_GLOBE_LAYER_SIZE,
  SHARE_ARTBOARDS,
  createShareRenderPlan,
  routeFramingCamera,
} from "./share-plan";
import { ShareRenderError } from "./share-errors";
import { listPngChunks, readPngHeader } from "./share-png";

const flight = (origin: string, destination: string): KeeprawFlight => ({
  id: `${origin}-${destination}`,
  flightNumber: "XX1",
  serviceDate: "2025-01-01",
  airline: { iata: "XX" },
  origin: { iata: origin },
  destination: { iata: destination },
  scheduledDeparture: "2025-01-01T08:00:00Z",
  scheduledArrival: "2025-01-01T10:00:00Z",
});

describe("share render plan", () => {
  it("exposes exactly the two stage 3 artboards", () => {
    expect(SHARE_ARTBOARDS).toEqual({
      "4:5": { width: 1080, height: 1350 },
      "9:16": { width: 1080, height: 1920 },
    });
  });

  it("forces the fixed camera whenever routes are not shared", () => {
    const transatlantic = [flight("JFK", "LHR")];
    const { model } = buildShareRenderModel(transatlantic);
    const plan = createShareRenderPlan(model, {
      artboard: "9:16",
      camera: { lookAt: { latitude: 51, longitude: 0 }, distance: 3, fov: 30 },
    });
    expect(plan.camera).toEqual(FIXED_OVERVIEW_CAMERA);
    // Different trips produce the identical overview camera.
    const other = buildShareRenderModel([flight("SYD", "AKL")]).model;
    expect(createShareRenderPlan(other, { artboard: "9:16" }).camera).toEqual(
      plan.camera,
    );
  });

  it("frames shared routes and honours an explicit camera", () => {
    const { model } = buildShareRenderModel([flight("JFK", "LHR")], {
      privacy: "routes",
    });
    const framed = routeFramingCamera(model);
    expect(framed.lookAt.latitude).toBeGreaterThan(30);
    expect(framed.lookAt.longitude).toBeLessThan(0);
    const custom = {
      lookAt: { latitude: 10, longitude: 20 },
      distance: 4,
      fov: 25,
    };
    expect(
      createShareRenderPlan(model, { artboard: "4:5", camera: custom }).camera,
    ).toEqual(custom);
  });

  it("rejects invalid layers and cameras with a typed error", () => {
    const { model } = buildShareRenderModel([], { privacy: "routes" });
    const attempt = (globe: { x: number; y: number; size: number }) => () =>
      createShareRenderPlan(model, { artboard: "4:5", globe });
    expect(attempt({ x: 0, y: 0, size: MAX_GLOBE_LAYER_SIZE + 1 })).toThrow(
      ShareRenderError,
    );
    expect(attempt({ x: Number.NaN, y: 0, size: 500 })).toThrow(/finite/);
    expect(() =>
      createShareRenderPlan(model, {
        artboard: "4:5",
        camera: { lookAt: { latitude: 0, longitude: 0 }, distance: 1, fov: 30 },
      }),
    ).toThrow(/camera/i);
  });
});

describe("PNG header", () => {
  it("parses the signature, IHDR size and chunk list", () => {
    // 1×1 RGBA PNG.
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      ),
      (c) => c.charCodeAt(0),
    );
    expect(readPngHeader(bytes)).toMatchObject({ width: 1, height: 1 });
    expect(listPngChunks(bytes)).toEqual(["IHDR", "IDAT", "IEND"]);
    const broken = bytes.slice();
    broken[1] = 0;
    expect(readPngHeader(broken)).toBeNull();
  });
});
