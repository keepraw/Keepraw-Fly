import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import earth4096 from "../globe/assets/earth-4096.webp";
import night4096 from "../globe/assets/night-4096.webp";
import {
  atmosphereFragment,
  defaultLighting,
  globeVertex,
  surfaceFragment,
} from "../globe/globe-lighting";
import { routeArc, spherePoint } from "../globe/globe-math";
import { ShareRenderError, isShareRenderError } from "./share-errors";
import type { ShareRenderModel } from "./share-model";
import {
  FIXED_OVERVIEW_CAMERA,
  validateShareRenderPlan,
  type ShareCamera,
  type ShareRenderPlan,
} from "./share-plan";
import {
  prepareShareFonts,
  type ShareFonts,
  type ShareLocale,
} from "./share-text";
import { readPngHeader } from "./share-png";

/**
 * Static share renderer: one WebGL2 context, one Earth scene and one pair of
 * reusable render targets, independent of the interactive globe (no
 * OrbitControls, DOM labels, listeners on the page, ResizeObserver or RAF).
 *
 * Pipeline per image: validate → fonts → render the globe into a linear MSAA
 * target → tone map + sRGB encode into an RGBA8 target → asynchronous pixel
 * readback → flip rows into straight-alpha ImageData → Canvas 2D composition at
 * the fixed artboard size → canvas.toBlob("image/png") → PNG header check.
 * Jobs on one instance run strictly one after another.
 */

type Context2D = CanvasRenderingContext2D;

export interface ShareComposeFrame {
  model: ShareRenderModel;
  plan: ShareRenderPlan;
  fonts: ShareFonts;
  /** Artboard → canvas scale (1 for export, < 1 for preview). */
  scale: number;
  /** Draws the rendered Earth layer at the plan's globe rectangle. */
  drawGlobe: () => void;
}

/** Draws 2D layout in ARTBOARD coordinates; the same code serves preview and
 * export because the context is already scaled. */
export type ShareComposer = (
  context: Context2D,
  frame: ShareComposeFrame,
) => void;

export interface ShareRenderOptions {
  locale?: ShareLocale;
  compose?: ShareComposer;
  /** Preview only: lower resolution, same layout coordinates. */
  scale?: number;
  fontTimeoutMs?: number;
  disableWebfont?: boolean;
  fontSample?: string;
}

export interface ShareRenderDiagnostics {
  globeLayerPixels: number;
  /** Fraction of globe-layer pixels with non-zero alpha. */
  globeCoverage: number;
  readback: "async" | "sync";
  samples: number;
  fonts: ShareFonts["status"];
  routesDrawn: number;
  milliseconds: number;
}

export interface SharePngResult {
  blob: Blob;
  width: number;
  height: number;
  diagnostics: ShareRenderDiagnostics;
}

export interface SharePreviewResult {
  canvas: HTMLCanvasElement;
  diagnostics: ShareRenderDiagnostics;
}

export interface ShareRendererOptions {
  /** Supply a canvas (tests use this to exercise context loss). */
  canvas?: HTMLCanvasElement;
  /** Override texture URLs (tests use this for load failures). */
  textures?: { day: string; night: string };
  /** Force the synchronous readPixels path (compatibility tests). */
  readback?: "async" | "sync";
}

export interface ShareRenderer {
  readonly state: () => "ready" | "lost" | "disposed";
  renderPng: (
    model: ShareRenderModel,
    plan: ShareRenderPlan,
    options?: ShareRenderOptions,
  ) => Promise<SharePngResult>;
  renderPreview: (
    model: ShareRenderModel,
    plan: ShareRenderPlan,
    options?: ShareRenderOptions,
  ) => Promise<SharePreviewResult>;
  /** Releases every GPU resource and the context; the instance is unusable. */
  dispose: () => void;
}

const outputVertex = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Rendering into a target skips Three's tone mapping and output encoding, so
// apply exactly the interactive canvas' ACES Filmic + sRGB here. The linear
// target holds premultiplied color (Normal blending onto transparent black);
// un-premultiply first and write straight alpha, matching ImageData.
const outputFragment = /* glsl */ `
precision highp float;
uniform sampler2D source;
varying vec2 vUv;
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
void main() {
  vec4 color = texture2D(source, vUv);
  if (color.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 straight = color.rgb / color.a;
  straight = ACESFilmicToneMapping(straight);
  gl_FragColor = sRGBTransferOETF(vec4(straight, clamp(color.a, 0.0, 1.0)));
}`;

function loadTexture(url: string, colorSpace: THREE.ColorSpace) {
  return new THREE.TextureLoader().loadAsync(url).then(
    (texture) => {
      texture.colorSpace = colorSpace;
      return texture;
    },
    (cause) => {
      throw new ShareRenderError("texture", `Earth texture failed to load`, {
        cause,
        resource: url,
      });
    },
  );
}

const cameraPosition = (camera: ShareCamera) =>
  new THREE.Vector3(...spherePoint(camera.lookAt)).multiplyScalar(
    camera.distance,
  );

export async function createShareRenderer(
  options: ShareRendererOptions = {},
): Promise<ShareRenderer> {
  const owned: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(resource: T): T => {
    owned.push(resource);
    return resource;
  };
  const canvas = options.canvas ?? document.createElement("canvas");
  canvas.width = canvas.height = 1;
  let state: "ready" | "lost" | "disposed" = "ready";
  let shaderFailure: string | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  const lost = (event: Event) => {
    event.preventDefault?.();
    if (state === "ready") state = "lost";
  };
  const releaseAll = () => {
    canvas.removeEventListener("webglcontextlost", lost);
    for (const resource of owned.splice(0).reverse()) {
      try {
        resource.dispose();
      } catch {
        /* Continue releasing sibling resources. */
      }
    }
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
  };

  try {
    let reason = "This browser could not create a WebGL2 context.";
    const creationError = (event: Event) => {
      reason = (event as WebGLContextEvent).statusMessage || reason;
    };
    canvas.addEventListener("webglcontextcreationerror", creationError);
    const context = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "default",
    });
    canvas.removeEventListener("webglcontextcreationerror", creationError);
    if (!context) throw new ShareRenderError("webgl2-unavailable", reason);
    canvas.addEventListener("webglcontextlost", lost);
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
    } catch (cause) {
      context.getExtension("WEBGL_lose_context")?.loseContext();
      throw new ShareRenderError(
        "webgl-initialization",
        "Three.js could not initialise WebGL",
        { cause },
      );
    }
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      shaderFailure =
        [
          gl.getProgramInfoLog(program),
          gl.getShaderInfoLog(vertex),
          gl.getShaderInfoLog(fragment),
        ]
          .filter(Boolean)
          .join("\n")
          .trim() || "Shader compilation failed";
    };
    renderer.autoClear = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const gl = renderer;
    const samples = Math.min(4, gl.capabilities.maxSamples || 0);

    const [day, night] = await Promise.all([
      loadTexture(options.textures?.day ?? earth4096, THREE.SRGBColorSpace),
      loadTexture(options.textures?.night ?? night4096, THREE.NoColorSpace),
    ]);
    track(day);
    track(night);
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    day.anisotropy = night.anisotropy = anisotropy;

    const uniforms = {
      earth: { value: day },
      nightMap: { value: night },
      nightTexelSize: {
        value: new THREE.Vector2(1 / night.image.width, 1 / night.image.height),
      },
      dark: { value: 1 },
      sunDirection: { value: new THREE.Vector3(0, 0, 1) },
      sunIntensity: { value: defaultLighting.sunIntensity },
      twilightWidth: { value: defaultLighting.twilightWidth },
      atmosphereIntensity: { value: defaultLighting.atmosphereIntensity },
      nightIntensity: { value: defaultLighting.nightIntensity },
      horizonTwilight: { value: 0 },
      solarDiagnostic: { value: 0 },
      neutralProbe: { value: 0 },
      surfaceEnabled: { value: 1 },
      nightEnabled: { value: 1 },
      atmosphereEnabled: { value: 1 },
    };
    const scene = new THREE.Scene();
    scene.add(
      new THREE.Mesh(
        track(new THREE.SphereGeometry(1, 192, 128)),
        track(
          new THREE.ShaderMaterial({
            uniforms,
            vertexShader: globeVertex,
            fragmentShader: surfaceFragment,
          }),
        ),
      ),
    );
    scene.add(
      new THREE.Mesh(
        track(new THREE.SphereGeometry(1.026, 160, 96)),
        track(
          new THREE.ShaderMaterial({
            uniforms,
            vertexShader: globeVertex,
            fragmentShader: atmosphereFragment,
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
          }),
        ),
      ),
    );
    const markerGeometry = track(new THREE.SphereGeometry(1, 16, 12));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

    const output = new THREE.Scene();
    const outputUniforms: {
      source: { value: THREE.Texture | null };
      toneMappingExposure: { value: number };
    } = { source: { value: null }, toneMappingExposure: { value: 1 } };
    const outputMaterial = track(
      new THREE.RawShaderMaterial({
        uniforms: outputUniforms,
        vertexShader: outputVertex,
        fragmentShader: outputFragment,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
      }),
    );
    output.add(
      new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), outputMaterial),
    );
    const outputCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // One reusable pair, resized only when the layer size changes.
    const linear = track(
      new THREE.WebGLRenderTarget(16, 16, {
        type: THREE.HalfFloatType,
        samples,
        depthBuffer: true,
        colorSpace: THREE.LinearSRGBColorSpace,
      }),
    );
    const encoded = track(
      new THREE.WebGLRenderTarget(16, 16, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        colorSpace: THREE.NoColorSpace,
      }),
    );
    let readbackMode: "async" | "sync" = options.readback ?? "async";

    const assertAlive = () => {
      if (state === "disposed")
        throw new ShareRenderError(
          "disposed",
          "The share renderer was disposed",
        );
      if (state === "lost" || renderer?.getContext().isContextLost())
        throw new ShareRenderError(
          "context-lost",
          "The WebGL context was lost",
        );
      if (shaderFailure) throw new ShareRenderError("shader", shaderFailure);
    };

    async function renderGlobeLayer(
      model: ShareRenderModel,
      plan: ShareRenderPlan,
      size: number,
    ) {
      const routeObjects: { dispose: () => void }[] = [];
      try {
        assertAlive();
        uniforms.dark.value = plan.theme === "dark" ? 1 : 0;
        uniforms.sunDirection.value.set(...plan.sunDirection).normalize();
        // Defense in depth: without shared routes the camera is always fixed.
        const view =
          model.privacy === "routes" ? plan.camera : FIXED_OVERVIEW_CAMERA;
        camera.fov = view.fov;
        camera.aspect = 1;
        camera.near = Math.max(0.01, view.distance - 1.2);
        camera.far = view.distance + 2;
        camera.position.copy(cameraPosition(view));
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        const routes = model.privacy === "routes" ? model.routes : [];
        const airports = model.privacy === "routes" ? model.airports : [];
        const resolutionScale = size / plan.globe.size;
        const routeGroup = new THREE.Group();
        for (const route of routes) {
          const points = routeArc({
            origin: { iata: "", ...route.from },
            destination: { iata: "", ...route.to },
            flightCount: route.flights,
          });
          const geometry = new LineGeometry();
          geometry.setPositions(points.flat());
          const material = new LineMaterial({
            color: plan.routeStyle.color,
            linewidth: plan.routeStyle.width * resolutionScale,
            transparent: true,
            opacity: plan.routeStyle.opacity,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
          });
          material.resolution.set(size, size);
          routeObjects.push(geometry, material);
          const line = new Line2(geometry, material);
          line.computeLineDistances();
          line.renderOrder = 2;
          routeGroup.add(line);
        }
        if (airports.length) {
          const markerMaterial = new THREE.MeshBasicMaterial({
            color: plan.routeStyle.markerColor,
            toneMapped: false,
          });
          routeObjects.push(markerMaterial);
          for (const airport of airports) {
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(...spherePoint(airport)).multiplyScalar(1.004);
            marker.scale.setScalar(plan.routeStyle.markerRadius);
            routeGroup.add(marker);
          }
        }
        scene.add(routeGroup);
        try {
          if (linear.width !== size || linear.height !== size) {
            linear.setSize(size, size);
            encoded.setSize(size, size);
          }
          const r = renderer!;
          // Line2.onBeforeRender reads renderer.getViewport() (the 1×1 canvas,
          // not the target) as its pixel resolution. Set it to the layer size
          // BEFORE binding the target, which then applies its own viewport.
          r.setViewport(0, 0, size, size);
          r.setRenderTarget(linear);
          r.setClearColor(0x000000, 0);
          r.clear(true, true, true);
          r.render(scene, camera);
          outputUniforms.source.value = linear.texture;
          r.setRenderTarget(encoded);
          r.clear(true, false, false);
          r.render(output, outputCamera);
          r.setRenderTarget(null);
          r.setViewport(0, 0, 1, 1);
        } finally {
          scene.remove(routeGroup);
        }
        assertAlive();
        const pixels = new Uint8Array(size * size * 4);
        try {
          if (readbackMode === "async")
            await renderer!.readRenderTargetPixelsAsync(
              encoded,
              0,
              0,
              size,
              size,
              pixels,
            );
          else
            renderer!.readRenderTargetPixels(encoded, 0, 0, size, size, pixels);
        } catch (cause) {
          assertAlive();
          if (readbackMode === "async") {
            // Tested compatibility path for engines without fence/PBO reads.
            readbackMode = "sync";
            renderer!.readRenderTargetPixels(encoded, 0, 0, size, size, pixels);
          } else
            throw new ShareRenderError("readback", "Pixel readback failed", {
              cause,
            });
        }
        assertAlive();
        // WebGL rows start at the bottom; ImageData rows start at the top.
        const image = new ImageData(size, size);
        const row = size * 4;
        let covered = 0;
        for (let y = 0; y < size; y += 1) {
          const source = (size - 1 - y) * row;
          image.data.set(pixels.subarray(source, source + row), y * row);
        }
        for (let i = 3; i < image.data.length; i += 4)
          if (image.data[i]! > 0) covered += 1;
        const coverage = covered / (size * size);
        if (coverage < 0.01)
          throw new ShareRenderError(
            "readback",
            "The rendered Earth layer is empty",
          );
        const layer = document.createElement("canvas");
        layer.width = layer.height = size;
        const layerContext = layer.getContext("2d");
        if (!layerContext)
          throw new ShareRenderError("encoding", "Canvas 2D is unavailable");
        layerContext.putImageData(image, 0, 0);
        return { layer, coverage, routesDrawn: routes.length };
      } finally {
        for (const resource of routeObjects) resource.dispose();
      }
    }

    async function composeCanvas(
      model: ShareRenderModel,
      plan: ShareRenderPlan,
      renderOptions: ShareRenderOptions,
      scale: number,
    ) {
      const started = performance.now();
      validateShareRenderPlan(plan);
      assertAlive();
      const fonts = await prepareShareFonts(renderOptions.locale ?? "en", {
        timeoutMs: renderOptions.fontTimeoutMs,
        disableWebfont: renderOptions.disableWebfont,
        sample: renderOptions.fontSample,
      });
      const size = Math.max(16, Math.round(plan.globe.size * scale));
      const globe = await renderGlobeLayer(model, plan, size);
      const target = document.createElement("canvas");
      target.width = Math.round(plan.width * scale);
      target.height = Math.round(plan.height * scale);
      const context = target.getContext("2d", { alpha: false });
      if (!context)
        throw new ShareRenderError("encoding", "Canvas 2D is unavailable");
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const drawGlobe = () =>
        context.drawImage(
          globe.layer,
          plan.globe.x,
          plan.globe.y,
          plan.globe.size,
          plan.globe.size,
        );
      const compose = renderOptions.compose ?? defaultComposer;
      compose(context, { model, plan, fonts, scale, drawGlobe });
      context.setTransform(1, 0, 0, 1, 0, 0);
      globe.layer.width = globe.layer.height = 0;
      return {
        canvas: target,
        diagnostics: {
          globeLayerPixels: size,
          globeCoverage: globe.coverage,
          readback: readbackMode,
          samples,
          fonts: fonts.status,
          routesDrawn: globe.routesDrawn,
          milliseconds: Math.round(performance.now() - started),
        } satisfies ShareRenderDiagnostics,
      };
    }

    let queue: Promise<unknown> = Promise.resolve();
    const serial = <T>(job: () => Promise<T>): Promise<T> => {
      const run = queue.then(job, job);
      queue = run.catch(() => undefined);
      return run;
    };
    const wrap = (cause: unknown): never => {
      if (isShareRenderError(cause)) throw cause;
      if (state === "lost" || renderer?.getContext().isContextLost())
        throw new ShareRenderError(
          "context-lost",
          "The WebGL context was lost",
          {
            cause,
          },
        );
      throw new ShareRenderError("shader", "Rendering failed", { cause });
    };

    // Warm-up: compile every program and prove a non-empty first frame.
    try {
      await renderer.compileAsync(scene, camera);
      await renderer.compileAsync(output, outputCamera);
      const probe = await renderGlobeLayer(
        warmupModel,
        {
          artboard: "4:5",
          width: 1080,
          height: 1350,
          globe: { x: 0, y: 0, size: 64 },
          camera: FIXED_OVERVIEW_CAMERA,
          theme: "dark",
          sunDirection: [0, 0, 1],
          routeStyle: {
            color: "#ffffff",
            width: 1,
            opacity: 1,
            markerColor: "#ffffff",
            markerRadius: 0.005,
          },
        },
        64,
      );
      probe.layer.width = probe.layer.height = 0;
    } catch (cause) {
      wrap(cause);
    }

    const instance: ShareRenderer = {
      state: () => state,
      renderPng: (model, plan, renderOptions = {}) =>
        serial(async () => {
          try {
            const { canvas: target, diagnostics } = await composeCanvas(
              model,
              plan,
              renderOptions,
              1,
            );
            assertAlive();
            const blob = await new Promise<Blob | null>((resolve) =>
              target.toBlob(resolve, "image/png"),
            );
            target.width = target.height = 0;
            if (!blob || blob.type !== "image/png")
              throw new ShareRenderError("encoding", "PNG encoding failed");
            const header = readPngHeader(
              new Uint8Array(await blob.slice(0, 33).arrayBuffer()),
            );
            if (
              !header ||
              header.width !== plan.width ||
              header.height !== plan.height
            )
              throw new ShareRenderError(
                "encoding",
                "The encoded PNG has an unexpected header",
              );
            assertAlive();
            return {
              blob,
              width: header.width,
              height: header.height,
              diagnostics,
            };
          } catch (cause) {
            return wrap(cause);
          }
        }),
      renderPreview: (model, plan, renderOptions = {}) =>
        serial(async () => {
          try {
            const scale = Math.min(
              1,
              Math.max(0.1, renderOptions.scale ?? 0.5),
            );
            return await composeCanvas(model, plan, renderOptions, scale);
          } catch (cause) {
            return wrap(cause);
          }
        }),
      dispose: () => {
        if (state === "disposed") return;
        state = "disposed";
        releaseAll();
      },
    };
    return instance;
  } catch (cause) {
    releaseAll();
    state = "disposed";
    if (isShareRenderError(cause)) throw cause;
    throw new ShareRenderError("webgl-initialization", String(cause), {
      cause,
    });
  }
}

const warmupModel: ShareRenderModel = {
  version: 1,
  scope: { kind: "lifetime" },
  privacy: "overview",
  airportLabels: false,
  yearRange: null,
  statistics: {
    flights: 0,
    distanceKilometers: 0,
    distanceKnownFlights: 0,
    distanceUnknownFlights: 0,
    countries: 0,
    airports: 0,
    airlines: 0,
    longestFlightKilometers: null,
  },
  routes: [],
  airports: [],
};

/** Neutral composition: solid background and the Earth layer only. */
export const defaultComposer: ShareComposer = (context, frame) => {
  context.fillStyle = frame.plan.theme === "dark" ? "#0b1220" : "#eef3f8";
  context.fillRect(0, 0, frame.plan.width, frame.plan.height);
  frame.drawGlobe();
};
