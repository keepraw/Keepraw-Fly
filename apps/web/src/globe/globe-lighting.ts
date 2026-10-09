import * as THREE from "three";
import type { Vec3 } from "./globe-math";

export interface GlobeLighting {
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
  earthOnly: false,
  surface: true,
  nightLights: true,
  atmosphere: true,
  sunIntensity: 2.2,
  twilightWidth: 0.18,
  atmosphereIntensity: 1,
  nightIntensity: 1.6,
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
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  // SRGBColorSpace surface samples are already decoded by the GPU to linear.
  vec3 linearTex = texture2D(earth, vUv).rgb;
  vec3 tex = pow(max(linearTex, vec3(0.0)), vec3(1.0 / 2.2));
  float lum = dot(tex, vec3(.2126, .7152, .0722));
  float ocean = smoothstep(.008, .045, tex.b - max(tex.r, tex.g));
  float detail = pow(clamp(lum, 0.0, 1.0), .8);
  vec3 land = mix(mix(vec3(.16,.31,.45), vec3(.55,.72,.88), detail),
                  mix(vec3(.014,.036,.065), vec3(.18,.30,.46), detail), dark);
  vec3 sea = mix(mix(vec3(.07,.22,.40), vec3(.12,.42,.61), lum),
                 mix(vec3(.008,.032,.070), vec3(.018,.085,.15), lum), dark);
  vec3 albedo = mix(land, sea, ocean);
  vec3 n = normalize(vWorldNormal);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float solar = dot(n, sunDirection);
  float day = smoothstep(-twilightWidth, twilightWidth, solar);
  float diffuse = pow(max(solar, 0.0), .65);
  float ambient = mix(.52, .20, dark);
  float illumination = mix(.68 + sunIntensity*.35*(.28+.72*diffuse*day), ambient + sunIntensity*diffuse*day, dark);
  vec3 color = albedo * illumination * surfaceEnabled;
  // Broad, low-amplitude ocean reflection; no mirror-like white disk.
  float specular = pow(max(dot(n, normalize(sunDirection + view)), 0.0), 90.0);
  color += vec3(.025,.06,.10) * specular * ocean * day * surfaceEnabled;
  // Same equirectangular UV registration as the day surface; raw grayscale data.
  float radiance = texture2D(nightMap, vUv).r;
  float lights = pow(max(radiance - .012, 0.0), .85);
  vec3 warm = mix(vec3(1.0,.39,.10), vec3(1.0,.86,.57), sqrt(lights));
  float night = 1.0 - smoothstep(-twilightWidth * .7, twilightWidth * .35, solar);
  color += warm * lights * night * nightIntensity * nightEnabled * mix(.28, 1.0, dark);
  // In-scattering along the surface tangent joins the outer shell continuously.
  float rim = pow(1.0 - max(dot(n, view), 0.0), 3.5);
  float sunlitAir = smoothstep(-.25, .45, solar);
  vec3 scatter = mix(vec3(.004,.016,.042), vec3(.13,.38,.75), sunlitAir);
  float sunrise = pow(smoothstep(.35,.85,solar),3.0);
  scatter += mix(vec3(.23,.38,.60),vec3(.85,.74,.63),dark) * sunrise * .85;
  color += scatter * rim * atmosphereIntensity * atmosphereEnabled * mix(.45,.7,dark);
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
varying vec3 vWorldPosition;
void main() {
  vec3 ray = normalize(vWorldPosition - cameraPosition);
  float closestT = -dot(cameraPosition, ray);
  vec3 closest = cameraPosition + ray * closestT;
  float impact = length(closest);
  float altitude = max(impact - 1.0, 0.0);
  float density = exp(-altitude / .007);
  float outerFade = 1.0 - smoothstep(.014, .026, altitude);
  vec3 n = normalize(closest);
  float solar = dot(n, sunDirection);
  float day = smoothstep(-.25, .45, solar);
  float phase = .75 * (1.0 + pow(dot(ray, sunDirection), 2.0));
  vec3 color = mix(vec3(.018,.07,.18), vec3(.18,.48,1.0), day);
  float sunrise = pow(smoothstep(.35,.85,solar),3.0);
  color = mix(color, mix(vec3(.73,.86,1.0),vec3(.94,.86,.78),dark), sunrise * .85);
  float alpha = density * outerFade * phase * mix(.35,.62,day) * atmosphereIntensity;
  alpha *= mix(.7,1.0,dark);
  alpha *= 1.0 + sunrise * .6;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, .85));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
