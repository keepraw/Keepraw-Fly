import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { RouteSegment } from "@keepraw-fly/core";
import {
  defaultGlobeView,
  globeAirports,
  physicalGlobeRoutes,
  routeArc,
  routeKey,
  selectedRouteView,
  spherePoint,
  visibleFrom,
  type GlobeView,
  type Vec3,
} from "./globe-math";
import earth4096 from "./assets/earth-4096.webp";
import earth2048 from "./assets/earth-2048.webp";
import night4096 from "./assets/night-4096.webp";
import night2048 from "./assets/night-2048.webp";
import {
  defaultLighting,
  globeSunDirection,
  globeVertex,
  surfaceFragment,
  atmosphereFragment,
  type GlobeLighting,
} from "./globe-lighting";

export type GlobeTheme = "light" | "dark";
export type GlobeSelection =
  | { kind: "airport"; code: string }
  | { kind: "route"; origin: string; destination: string };
export interface GlobeMetrics {
  firstFrameMs: number;
  textureReadyMs?: number;
  texturedFrameMs?: number;
  frames: number;
  lastFrameMs: number;
  recentFrameMs: number[];
  drawCalls: number;
  textureSize: number;
  pixelRatio: number;
}
export interface GlobeController {
  lighting: (settings: GlobeLighting) => void;
  theme: (theme: GlobeTheme) => void;
  select: (selection: GlobeSelection | null) => void;
  highlight: (key?: string) => void;
  zoom: (factor: number) => void;
  home: () => void;
  dispose: () => void;
}

const vector = (v: Vec3) => new THREE.Vector3(...v);

export function createGlobe(
  host: HTMLDivElement,
  labels: HTMLDivElement,
  routes: RouteSegment[],
  initialTheme: GlobeTheme,
  quality: "2048" | "4096",
  callbacks: {
    select: (s: GlobeSelection) => void;
    canvasLabel: string;
    airportLabel: (code: string, count: number) => string;
    routeLabel: (origin: string, destination: string, count: number) => string;
    hover: (text: string | null) => void;
    error: (reason: string) => void;
  },
): GlobeController {
  const start = performance.now();
  delete host.dataset.ready;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.className = "globe-webgl";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", callbacks.canvasLabel);
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  let home = defaultGlobeView(routes, {
    width: host.clientWidth || 1008,
    height: host.clientHeight || 610,
  });
  camera.position.copy(vector(home.direction).multiplyScalar(home.distance));
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.enableRotate = true;
  controls.minDistance = 1.45;
  controls.maxDistance = 6.2;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  const uniforms = {
    earth: { value: new THREE.Texture() },
    nightMap: { value: new THREE.Texture() },
    dark: { value: initialTheme === "dark" ? 1 : 0 },
    sunDirection: { value: globeSunDirection(home.direction) },
    sunIntensity: { value: defaultLighting.sunIntensity },
    twilightWidth: { value: defaultLighting.twilightWidth },
    atmosphereIntensity: { value: defaultLighting.atmosphereIntensity },
    nightIntensity: { value: defaultLighting.nightIntensity },
    surfaceEnabled: { value: 1 },
    nightEnabled: { value: 1 },
    atmosphereEnabled: { value: 1 },
  };
  const geometry = new THREE.SphereGeometry(1, 160, 96);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: globeVertex,
    fragmentShader: surfaceFragment,
  });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.026, 128, 80),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: globeVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  scene.add(atmosphere);
  const airports = globeAirports(routes);
  const airportGeometry = new THREE.SphereGeometry(0.005, 10, 8);
  const airportMaterials = airports.map(
    () => new THREE.MeshBasicMaterial({ color: 0xa6dbff }),
  );
  const markers = airports.map((point, index) => {
    const marker = new THREE.Mesh(airportGeometry, airportMaterials[index]);
    marker.position.copy(vector(spherePoint(point)).multiplyScalar(1.005));
    scene.add(marker);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "globe-airport-label";
    label.textContent = point.iata;
    label.setAttribute(
      "aria-label",
      callbacks.airportLabel(point.iata, point.flightCount),
    );
    label.addEventListener("click", () =>
      callbacks.select({ kind: "airport", code: point.iata }),
    );
    labels.append(label);
    return { point, marker, label };
  });
  const routeLines = physicalGlobeRoutes(routes).map((directions) => {
    const route = directions[0]!;
    const points = routeArc(route);
    const lineGeometry = new LineGeometry();
    lineGeometry.setPositions(points.flat());
    const lineMaterial = new LineMaterial({
      color: 0x529bd0,
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const selectedUniform = { value: 0 };
    lineMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.sceneSelected = selectedUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vRouteFacing;",
        )
        .replace(
          "void main() {",
          `void main() {
            vec3 routeWorld = (modelMatrix * vec4(position.y < 0.5 ? instanceStart : instanceEnd, 1.0)).xyz;
            vRouteFacing = dot(normalize(routeWorld), normalize(cameraPosition - routeWorld));`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vRouteFacing;\nuniform float sceneSelected;",
        )
        .replace(
          "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
          `
            float limbFloor = mix(0.04, 0.18, sceneSelected);
            alpha *= limbFloor + (1.0 - limbFloor) * smoothstep(-0.02, 0.30, vRouteFacing);
            gl_FragColor = vec4( diffuseColor.rgb, alpha );`,
        );
    };
    lineMaterial.customProgramCacheKey = () => "globe-route-limb-v1";
    const line = new Line2(lineGeometry, lineMaterial);
    line.computeLineDistances();
    scene.add(line);
    return { route, directions, points, line, selectedUniform };
  });
  let disposed = false,
    frame = 0,
    width = 1,
    height = 1,
    selected: GlobeSelection | null = null,
    highlight: string | undefined;
  let lighting = { ...defaultLighting };
  let moving: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;
  let dragging = false,
    pointerStart = { x: 0, y: 0 };
  let viewOffset = home.offset ?? { x: 0, y: 0 };
  let atHome = true;
  const metrics: GlobeMetrics = {
    firstFrameMs: 0,
    frames: 0,
    lastFrameMs: 0,
    recentFrameMs: [],
    drawCalls: 0,
    textureSize: 0,
    pixelRatio: renderer.getPixelRatio(),
  };
  (host as HTMLDivElement & { globeMetrics: GlobeMetrics }).globeMetrics =
    metrics;
  const isSelectedRoute = (r: RouteSegment) =>
    selected?.kind === "route" &&
    selected.origin === r.origin.iata &&
    selected.destination === r.destination.iata;
  function paintStyles() {
    const dark = uniforms.dark.value === 1;
    for (const item of routeLines) {
      const active = item.directions.some(isSelectedRoute),
        hovered = item.directions.some((r) => highlight === routeKey(r));
      item.selectedUniform.value = active ? 1 : 0;
      item.line.material.color.set(
        active
          ? dark
            ? 0xff8172
            : 0xe85d52
          : hovered
            ? dark
              ? 0xc7eeff
              : 0x1357a4
            : dark
              ? 0x65a8d6
              : 0x2876c9,
      );
      const level = Math.min(
        Math.log2(
          item.directions.reduce((sum, r) => sum + r.flightCount, 0) + 1,
        ),
        3,
      );
      item.line.material.linewidth = active
        ? 1.65
        : hovered
          ? 1.3
          : 0.85 + level * 0.08;
      item.line.material.opacity = active
        ? 0.92
        : hovered
          ? 0.8
          : (selected?.kind === "route" ? 0.27 : 0.4) + level * 0.1;
      item.line.renderOrder = active ? 3 : hovered ? 2 : 1;
    }
    for (const item of markers) {
      const active =
        selected?.kind === "airport"
          ? selected.code === item.point.iata
          : selected?.kind === "route" &&
            [selected.origin, selected.destination].includes(item.point.iata);
      item.marker.material.color.set(
        active ? (dark ? 0xffa293 : 0xd95349) : dark ? 0xc0e3ff : 0x255e9c,
      );
      item.marker.scale.setScalar(active ? 1.55 : 1);
      item.label.classList.toggle("is-selected", Boolean(active));
    }
    invalidate();
  }
  function project(v: Vec3) {
    const p = vector(v).project(camera);
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2, z: p.z };
  }
  function layoutLabels() {
    if (lighting.earthOnly) {
      for (const item of markers) item.label.hidden = true;
      return;
    }
    const cam = camera.position.toArray() as unknown as Vec3;
    const boxes: { x: number; y: number }[] = [];
    const sorted = [...markers].sort(
      (a, b) =>
        Number(b.label.classList.contains("is-selected")) -
          Number(a.label.classList.contains("is-selected")) ||
        b.point.flightCount - a.point.flightCount,
    );
    for (const item of sorted) {
      const v = item.marker.position.toArray() as unknown as Vec3,
        p = project(v);
      const required = item.label.classList.contains("is-selected");
      const visible =
        visibleFrom(v, cam) &&
        p.x > 12 &&
        p.x < width - 45 &&
        p.y > 42 &&
        p.y < height - 45 &&
        p.z < 1;
      const collision = boxes.some(
        (b) => Math.abs(b.x - p.x) < 43 && Math.abs(b.y - p.y) < 21,
      );
      const show =
        visible && (!collision || required) && (required || boxes.length < 12);
      item.label.hidden = !show;
      if (show) {
        item.label.style.transform = `translate(${p.x + 7}px,${p.y - 16}px)`;
        boxes.push(p);
      }
    }
  }
  function render(now: number) {
    frame = 0;
    if (disposed) return;
    const began = performance.now();
    if (moving) {
      const t = Math.min(1, (now - moving.start) / moving.duration),
        eased = t * t * (3 - 2 * t);
      const from = moving.from.clone(),
        to = moving.to.clone();
      const direction = vectorFromInterpolation(from, to, eased);
      camera.position.copy(direction);
      camera.lookAt(0, 0, 0);
      controls.update();
      if (t === 1) moving = null;
    }
    renderer.render(scene, camera);
    layoutLabels();
    host.dataset.camera = JSON.stringify(camera.position.toArray());
    host.dataset.scene = JSON.stringify({
      camera: camera.position.toArray(),
      fov: camera.fov,
      viewOffset,
      viewport: { width, height },
      home,
      atHome,
      physicalRoutes: routeLines.length,
      routes: routeLines.flatMap((item) =>
        item.directions.map((route) => ({
          key: routeKey(route),
          count: route.flightCount,
          maxAltitude: Math.max(
            ...item.points.map((p) => Math.hypot(...p) - 1),
          ),
        })),
      ),
    });
    host.dataset.lighting = JSON.stringify({
      ...lighting,
      sunDirection: uniforms.sunDirection.value.toArray(),
      exposure: renderer.toneMappingExposure,
      theme: uniforms.dark.value ? "dark" : "light",
    });
    metrics.frames++;
    metrics.drawCalls = renderer.info.render.calls;
    metrics.lastFrameMs = performance.now() - began;
    metrics.recentFrameMs.push(metrics.lastFrameMs);
    if (metrics.recentFrameMs.length > 120) metrics.recentFrameMs.shift();
    if (!metrics.firstFrameMs) metrics.firstFrameMs = performance.now() - start;
    if (metrics.textureReadyMs && !metrics.texturedFrameMs)
      metrics.texturedFrameMs = performance.now() - start;
    if (moving) invalidate();
  }
  function invalidate() {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  }
  function flyTo(view: GlobeView, center = true) {
    atHome = !center;
    viewOffset = view.offset ?? { x: 0, y: 0 };
    const to = vector(view.direction).multiplyScalar(view.distance);
    // Selection centers the route; Home returns to the deliberately cropped composition.
    camera.setViewOffset(
      width,
      height,
      width * viewOffset.x,
      height * viewOffset.y,
      width,
      height,
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      moving = null;
      camera.position.copy(to);
      camera.lookAt(0, 0, 0);
      controls.update();
      invalidate();
      return;
    }
    moving = {
      from: camera.position.clone(),
      to,
      start: performance.now(),
      duration: 650,
    };
    invalidate();
  }
  // DEV-only Lab capture seam: lock historical cameras without moving the sun.
  const reviewHost = host as HTMLDivElement & {
    globeReviewView?: (view: GlobeView) => void;
  };
  reviewHost.globeReviewView = (view) => flyTo(view);
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    home = defaultGlobeView(routes, { width, height });
    if (atHome) {
      moving = null;
      camera.position.copy(
        vector(home.direction).multiplyScalar(home.distance),
      );
      camera.lookAt(0, 0, 0);
      viewOffset = home.offset ?? { x: 0, y: 0 };
      controls.update();
    }
    camera.setViewOffset(
      width,
      height,
      width * viewOffset.x,
      height * viewOffset.y,
      width,
      height,
    );
    camera.updateProjectionMatrix();
    for (const item of routeLines)
      item.line.material.resolution.set(width, height);
    invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let loadedTextures = 0;
  const textureReady = () => {
    if (++loadedTextures !== 2) return;
    metrics.textureReadyMs = performance.now() - start;
    host.dataset.ready = "true";
    invalidate();
  };
  const emptyEarth = uniforms.earth.value;
  const emptyNight = uniforms.nightMap.value;
  const texture = new THREE.TextureLoader().load(
    quality === "4096" ? earth4096 : earth2048,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      uniforms.earth.value = loaded;
      metrics.textureSize = loaded.image.width;
      emptyEarth.dispose();
      textureReady();
      invalidate();
    },
    undefined,
    () => {
      if (!disposed) callbacks.error("texture");
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  const nightTexture = new THREE.TextureLoader().load(
    quality === "4096" ? night4096 : night2048,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      uniforms.nightMap.value = loaded;
      emptyNight.dispose();
      textureReady();
      invalidate();
    },
    undefined,
    () => {
      if (!disposed) callbacks.error("texture");
    },
  );
  nightTexture.colorSpace = THREE.NoColorSpace;
  const change = () => invalidate();
  const controlStart = () => {
    atHome = false;
    moving = null;
    callbacks.hover(null);
  };
  controls.addEventListener("change", change);
  controls.addEventListener("start", controlStart);
  function pick(
    x: number,
    y: number,
  ): { selection: GlobeSelection; text: string; key?: string } | null {
    if (lighting.earthOnly) return null;
    const cam = camera.position.toArray() as unknown as Vec3;
    for (const item of markers) {
      const v = item.marker.position.toArray() as unknown as Vec3,
        p = project(v);
      if (visibleFrom(v, cam) && Math.hypot(p.x - x, p.y - y) < 12)
        return {
          selection: { kind: "airport", code: item.point.iata },
          text: callbacks.airportLabel(item.point.iata, item.point.flightCount),
        };
    }
    let best = 8,
      hit: null | { selection: GlobeSelection; text: string; key?: string } =
        null;
    for (const item of routeLines)
      for (let i = 1; i < item.points.length; i++) {
        const a = item.points[i - 1]!,
          b = item.points[i]!;
        if (!visibleFrom(a, cam) || !visibleFrom(b, cam)) continue;
        const p = project(a),
          q = project(b),
          dx = q.x - p.x,
          dy = q.y - p.y;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1),
          ),
        );
        const distance = Math.hypot(x - p.x - t * dx, y - p.y - t * dy);
        if (distance < best) {
          best = distance;
          const route = item.directions.find(isSelectedRoute) ?? item.route;
          hit = {
            selection: {
              kind: "route",
              origin: route.origin.iata,
              destination: route.destination.iata,
            },
            text: callbacks.routeLabel(
              route.origin.iata,
              route.destination.iata,
              route.flightCount,
            ),
            key: routeKey(route),
          };
        }
      }
    return hit;
  }
  const down = (e: PointerEvent) => {
    pointerStart = { x: e.clientX, y: e.clientY };
    dragging = false;
  };
  const move = (e: PointerEvent) => {
    if (e.buttons) {
      if (
        Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 4
      )
        dragging = true;
      return;
    }
    const rect = canvas.getBoundingClientRect(),
      hit = pick(e.clientX - rect.left, e.clientY - rect.top);
    highlight = hit?.key;
    callbacks.hover(hit?.text ?? null);
    canvas.style.cursor = hit ? "pointer" : "grab";
    paintStyles();
  };
  const up = (e: PointerEvent) => {
    if (dragging) return;
    const rect = canvas.getBoundingClientRect(),
      hit = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) callbacks.select(hit.selection);
  };
  const leave = () => {
    highlight = undefined;
    callbacks.hover(null);
    paintStyles();
  };
  const key = (e: KeyboardEvent) => {
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    if (e.key.startsWith("Arrow")) {
      atHome = false;
      e.preventDefault();
      moving = null;
      if (e.key === "ArrowLeft") spherical.theta -= 0.12;
      if (e.key === "ArrowRight") spherical.theta += 0.12;
      if (e.key === "ArrowUp") spherical.phi -= 0.08;
      if (e.key === "ArrowDown") spherical.phi += 0.08;
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      controls.update();
      invalidate();
    } else if (["+", "=", "-", "Home"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Home") flyTo(home, false);
      else zoom(e.key === "-" ? 1.15 : 1 / 1.15);
    }
  };
  function zoom(factor: number) {
    atHome = false;
    moving = null;
    camera.position.setLength(
      Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, camera.position.length() * factor),
      ),
    );
    controls.update();
    invalidate();
  }
  const lost = (event: Event) => {
    event.preventDefault();
    callbacks.error("context");
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("keydown", key);
  canvas.addEventListener("webglcontextlost", lost);
  resize();
  paintStyles();
  return {
    lighting(settings) {
      lighting = { ...settings };
      uniforms.sunIntensity.value = settings.sunIntensity;
      uniforms.twilightWidth.value = settings.twilightWidth;
      uniforms.atmosphereIntensity.value = settings.atmosphereIntensity;
      uniforms.nightIntensity.value = settings.nightIntensity;
      uniforms.surfaceEnabled.value = Number(settings.surface);
      uniforms.nightEnabled.value = Number(settings.nightLights);
      uniforms.atmosphereEnabled.value = Number(settings.atmosphere);
      atmosphere.visible = settings.atmosphere;
      for (const item of routeLines) item.line.visible = !settings.earthOnly;
      for (const item of markers) item.marker.visible = !settings.earthOnly;
      callbacks.hover(null);
      invalidate();
    },
    theme(theme) {
      uniforms.dark.value = theme === "dark" ? 1 : 0;
      paintStyles();
    },
    select(selection) {
      selected = selection;
      paintStyles();
      if (selection?.kind === "route") {
        const route = routes.find(
          (r) =>
            r.origin.iata === selection.origin &&
            r.destination.iata === selection.destination,
        );
        if (route) flyTo(selectedRouteView(route, { width, height }));
      } else if (selection?.kind === "airport") {
        const airport = airports.find((a) => a.iata === selection.code);
        if (airport)
          flyTo({
            direction: spherePoint(airport),
            distance: Math.max(2.4, camera.position.length()),
          });
      }
    },
    highlight(key) {
      highlight = key;
      paintStyles();
    },
    zoom,
    home() {
      flyTo(home, false);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("webglcontextlost", lost);
      for (const item of routeLines) {
        item.line.geometry.dispose();
        item.line.material.dispose();
      }
      for (const mat of airportMaterials) mat.dispose();
      airportGeometry.dispose();
      geometry.dispose();
      material.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      uniforms.earth.value.dispose();
      uniforms.nightMap.value.dispose();
      emptyEarth.dispose();
      emptyNight.dispose();
      texture.dispose();
      nightTexture.dispose();
      renderer.dispose();
      canvas.remove();
      labels.replaceChildren();
      delete host.dataset.ready;
      delete reviewHost.globeReviewView;
    },
  };
}

function vectorFromInterpolation(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
) {
  // Quaternion interpolation avoids collapse through the globe for opposite views.
  const from = a.clone().normalize(),
    to = b.clone().normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
  const current = new THREE.Quaternion().slerp(rotation, t);
  return from
    .applyQuaternion(current)
    .multiplyScalar(THREE.MathUtils.lerp(a.length(), b.length(), t));
}
