import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { RouteSegment } from "@keepraw-fly/core";
import {
  defaultGlobeView,
  globeAirports,
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
  theme: (theme: GlobeTheme) => void;
  select: (selection: GlobeSelection | null) => void;
  highlight: (key?: string) => void;
  zoom: (factor: number) => void;
  home: () => void;
  dispose: () => void;
}

const vertex = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
void main() { vUv=uv; vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.0); vPosition=p.xyz; gl_Position=projectionMatrix*p; }`;
const fragment = `uniform sampler2D earth; uniform float dark; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
void main() {
  vec3 tex=texture2D(earth,vUv).rgb;
  float lum=dot(tex,vec3(.299,.587,.114));
  float ocean=smoothstep(.008,.045,tex.b-max(tex.r,tex.g));
  float detail=pow(clamp(lum,0.0,1.0),.70);
  vec3 landLight=mix(vec3(.32,.54,.73),vec3(.93,.98,1.0),detail);
  vec3 landDark=mix(vec3(.06,.14,.23),vec3(.46,.59,.71),detail);
  vec3 seaLight=mix(vec3(.27,.56,.80),vec3(.52,.77,.94),clamp(lum*2.0,0.0,1.0));
  vec3 seaDark=mix(vec3(.013,.045,.095),vec3(.065,.18,.29),clamp(lum*2.0,0.0,1.0));
  vec3 base=mix(mix(landLight,seaLight,ocean),mix(landDark,seaDark,ocean),dark);
  vec3 n=normalize(vNormal), view=normalize(-vPosition);
  vec3 light=normalize(mix(vec3(-.45,.85,1.5),vec3(-.75,.8,.65),dark));
  float lambert=max(dot(n,light),0.0);
  float illumination=mix(.65+.44*lambert,.20+1.05*lambert,dark);
  float rim=pow(1.0-max(dot(n,view),0.0),3.5);
  float spec=pow(max(dot(reflect(-light,n),view),0.0),36.0)*ocean;
  vec3 color=base*illumination + vec3(.36,.62,.85)*spec*mix(.10,.07,dark);
  color=mix(color,mix(vec3(.56,.78,.97),vec3(.10,.27,.43),dark),rim*mix(.35,.28,dark));
  gl_FragColor=vec4(color,1.0);
}`;
const atmosphereFragment = `uniform float dark; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
void main(){ vec3 n=normalize(vNormal); float facing=abs(dot(n,normalize(-vPosition))); float alpha=pow(1.0-facing,6.0)*mix(.19,.24,dark); gl_FragColor=vec4(mix(vec3(.45,.73,1.0),vec3(.15,.40,.72),dark),alpha); }`;
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
  const canvas = renderer.domElement;
  canvas.className = "globe-webgl";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", callbacks.canvasLabel);
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  const home = defaultGlobeView(routes);
  camera.position.copy(vector(home.direction).multiplyScalar(home.distance));
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.enableRotate = true;
  controls.minDistance = 1.75;
  controls.maxDistance = 6.2;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  const uniforms = {
    earth: { value: new THREE.Texture() },
    dark: { value: initialTheme === "dark" ? 1 : 0 },
  };
  const geometry = new THREE.SphereGeometry(1, 160, 96);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
  });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 128, 80),
    new THREE.ShaderMaterial({
      uniforms: { dark: uniforms.dark },
      vertexShader: vertex,
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
  const routeLines = [...routes]
    .sort((a, b) => a.flightCount - b.flightCount)
    .map((route) => {
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
      });
      const line = new Line2(lineGeometry, lineMaterial);
      line.computeLineDistances();
      scene.add(line);
      return { route, points, line };
    });
  let disposed = false,
    frame = 0,
    width = 1,
    height = 1,
    selected: GlobeSelection | null = null,
    highlight: string | undefined;
  let moving: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;
  let dragging = false,
    pointerStart = { x: 0, y: 0 };
  let centered = false;
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
      const active = isSelectedRoute(item.route),
        hovered = highlight === routeKey(item.route);
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
              ? 0x68b6ed
              : 0x2876c9,
      );
      const level = Math.min(Math.log2(item.route.flightCount + 1), 3);
      item.line.material.linewidth = active
        ? 2.2
        : hovered
          ? 1.8
          : 0.95 + level * 0.28;
      item.line.material.opacity = active
        ? 1
        : hovered
          ? 0.95
          : (selected?.kind === "route" ? 0.44 : 0.65) + level * 0.06;
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
    centered = center;
    const to = vector(view.direction).multiplyScalar(view.distance);
    // Selection centers the route; Home returns to the deliberately cropped composition.
    camera.setViewOffset(
      width,
      height,
      0,
      center ? 0 : -height * 0.16,
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
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.setViewOffset(
      width,
      height,
      0,
      centered ? 0 : -height * 0.16,
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
      metrics.textureReadyMs = performance.now() - start;
      host.dataset.ready = "true";
      invalidate();
    },
    undefined,
    () => {
      if (!disposed) callbacks.error("texture");
    },
  );
  // Raw color values are intentionally graded in the shader, independently per theme.
  texture.colorSpace = THREE.NoColorSpace;
  const change = () => invalidate();
  const controlStart = () => {
    moving = null;
    callbacks.hover(null);
  };
  controls.addEventListener("change", change);
  controls.addEventListener("start", controlStart);
  function pick(
    x: number,
    y: number,
  ): { selection: GlobeSelection; text: string; key?: string } | null {
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
          hit = {
            selection: {
              kind: "route",
              origin: item.route.origin.iata,
              destination: item.route.destination.iata,
            },
            text: callbacks.routeLabel(
              item.route.origin.iata,
              item.route.destination.iata,
              item.route.flightCount,
            ),
            key: routeKey(item.route),
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
        if (route) flyTo(selectedRouteView(route));
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
      texture.dispose();
      renderer.dispose();
      canvas.remove();
      labels.replaceChildren();
      delete host.dataset.ready;
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
