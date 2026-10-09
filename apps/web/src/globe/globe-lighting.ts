import * as THREE from "three";
import type { Vec3 } from "./globe-math";

export interface GlobeLighting {
  artDirection: "A" | "B";
  earthOnly: boolean;
  surface: boolean;
  nightLights: boolean;
  atmosphere: boolean;
  sunIntensity: number;
  twilightWidth: number;
  atmosphereIntensity: number;
  nightIntensity: number;
}
export const defaultLighting: GlobeLighting = {
  artDirection: "A",
  earthOnly: false,
  surface: true,
  nightLights: true,
  atmosphere: true,
  sunIntensity: 2.2,
  twilightWidth: 0.18,
  atmosphereIntensity: 0.65,
  nightIntensity: 1,
};

// Art-directed once from the existing overview, then fixed in WORLD space.
// Orbiting the camera never moves the sun or the terminator over geography.
export function globeSunDirection(home: Vec3): THREE.Vector3 {
  const forward = new THREE.Vector3(...home).normalize();
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  return right
    .multiplyScalar(0.75)
    .addScaledVector(up, 0.42)
    .addScaledVector(forward, -0.5)
    .normalize();
}

export const globeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const surfaceFragment = /* glsl */ `
uniform sampler2D earth;
uniform sampler2D nightMap;
uniform vec3 sunDirection;
uniform float dark;
uniform float sunIntensity;
uniform float twilightWidth;
uniform float atmosphereIntensity;
uniform float nightIntensity;
uniform float surfaceEnabled;
uniform float nightEnabled;
uniform float atmosphereEnabled;
uniform float horizonTwilight;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
// Display-authored palette -> linear working space. The surface texture is
// already GPU-decoded; its sRGB value is used ONLY for geographic grading.
vec3 palette(vec3 c) {
  return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c));
}
void main() {
  // SRGBColorSpace surface samples are already decoded by the GPU to linear.
  vec3 linearTex = texture2D(earth, vUv).rgb;
  vec3 tex = mix(linearTex * 12.92, 1.055 * pow(max(linearTex, vec3(0.0)), vec3(1.0 / 2.4)) - .055, step(vec3(.0031308), linearTex));
  float lum = dot(tex, vec3(.2126, .7152, .0722));
  float ocean = smoothstep(.008, .045, tex.b - max(tex.r, tex.g));
  // A soft highlight shoulder keeps snow and bright terrain below white.
  float detail = clamp(lum * 1.32 / (.78 + lum), 0.0, 1.0);
  float relief = smoothstep(.10, .72, lum);
  // Retain the source's terrain variation without its green/brown cast.
  float terrain = clamp((tex.r - tex.g) * 2.5 + .5, 0.0, 1.0);
  vec3 lightLand = mix(vec3(.58,.71,.84), vec3(.87,.94,.995), relief);
  lightLand += (terrain - .5) * vec3(.035,.015,-.018);
  vec3 land = mix(palette(lightLand),
                  palette(mix(vec3(.12,.21,.31), vec3(.34,.45,.57), detail)), dark);
  vec3 sea = mix(palette(mix(vec3(.37,.54,.72), vec3(.48,.68,.84), clamp(lum * 2.8, 0.0, 1.0))),
                 palette(mix(vec3(.04,.115,.22), vec3(.085,.215,.34), clamp(lum * 3.0, 0.0, 1.0))), dark);
  vec3 albedo = mix(land, sea, ocean);
  vec3 n = normalize(vWorldNormal);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float solar = dot(n, sunDirection);
  float day = smoothstep(-twilightWidth, twilightWidth, solar);
  float diffuse = pow(max(solar, 0.0), .65);
  // Selective night fill exposes terrain; it does not lift the entire canvas.
  float ambient = .52 + .08 * detail * (1.0 - ocean);
  float illumination = mix(.82 + sunIntensity*.22*diffuse*day, ambient + sunIntensity*diffuse*day, dark);
  vec3 color = albedo * illumination * surfaceEnabled;
  // Broad, low-amplitude ocean reflection; no mirror-like white disk.
  float specular = pow(max(dot(n, normalize(sunDirection + view)), 0.0), 90.0);
  color += vec3(.025,.06,.10) * specular * ocean * day * surfaceEnabled;
  // Same equirectangular UV registration as the day surface; raw grayscale data.
  float radiance = texture2D(nightMap, vUv).r;
  // Monotonic toe + midtone shaping + bounded shoulder. No spatial masking,
  // deletion, extra samples or invented lights; every UV uses the same curve.
  float signal = max(radiance - .012, 0.0);
  float toe = smoothstep(0.0, .075, signal);
  float midtone = pow(signal, 1.25);
  float lights = .13 * midtone / (.24 + midtone) * toe;
  vec3 warm = mix(vec3(.83,.77,.66), vec3(.96,.90,.79), smoothstep(.1,.8, signal));
  float night = 1.0 - smoothstep(-twilightWidth, twilightWidth * .15, solar);
  // The grayscale Black Marble visualization is non-color data, never gamma decoded.
  color += warm * lights * night * nightIntensity * nightEnabled * dark;
  // In-scattering along the surface tangent joins the outer shell continuously.
  float grazing = 1.0 - max(dot(n, view), 0.0);
  float rim = pow(grazing, 7.0);
  float sunlitAir = smoothstep(-.10, .65, solar);
  vec3 scatter = mix(vec3(.002,.007,.018), vec3(.065,.17,.32), sunlitAir);
  // B changes only local limb light distribution, at the same sun/exposure.
  float sunrise = pow(smoothstep(.10,.70,solar), 3.0);
  scatter += vec3(.45,.53,.60) * sunrise * horizonTwilight;
  float shoulder = pow(grazing, 4.5) * sunrise * horizonTwilight;
  color += (scatter * rim + vec3(.055,.085,.12) * shoulder) * atmosphereIntensity * atmosphereEnabled * mix(.32,1.0,dark);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Single-pass grazing-altitude approximation through a spherical shell.
// the density fades with altitude and the light changes around the entire limb.
export const atmosphereFragment = /* glsl */ `
uniform vec3 sunDirection;
uniform float dark;
uniform float atmosphereIntensity;
uniform float horizonTwilight;
varying vec3 vWorldPosition;
void main() {
  vec3 ray = normalize(vWorldPosition - cameraPosition);
  float closestT = -dot(cameraPosition, ray);
  vec3 closest = cameraPosition + ray * closestT;
  float impact = length(closest);
  float altitude = max(impact - 1.0, 0.0);
  // A narrow core and a very low-amplitude skirt join the surface tangent.
  float core = exp(-altitude / .0032);
  float skirt = exp(-altitude / .0065) * horizonTwilight * .16;
  float outerFade = 1.0 - smoothstep(.010, .022, altitude);
  vec3 n = normalize(closest);
  float solar = dot(n, sunDirection);
  float day = smoothstep(-.10, .65, solar);
  float phase = .75 * (1.0 + pow(dot(ray, sunDirection), 2.0));
  vec3 color = mix(vec3(.008,.028,.065), vec3(.11,.28,.49), day);
  float sunrise = pow(smoothstep(.10,.70,solar),3.0);
  color = mix(color, vec3(.42,.49,.55), sunrise * horizonTwilight * .85);
  float alpha = (core + skirt * sunrise) * outerFade * phase * mix(.045,.38,day) * atmosphereIntensity;
  alpha *= mix(.4,1.0,dark);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, .45));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
