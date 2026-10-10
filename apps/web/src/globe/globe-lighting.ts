import * as THREE from "three";
import type { Vec3 } from "./globe-math";
import { nightResponseKernel } from "./globe-night-response";
import { darkCityEmissionKernel } from "./globe-night-emission";

export interface GlobeLighting {
  artDirection: "A" | "B";
  earthOnly: boolean;
  solarDiagnostic: boolean;
  neutralProbe: boolean;
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
  solarDiagnostic: false,
  neutralProbe: false,
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

// Solar geometry has no theme or art-direction input. Keep the CPU reference
// and the shared GPU kernel together; browser tests exercise the rendered result.
export function solarRegion(normal: Vec3, sun: Vec3, width = 0.18) {
  const cosine = normal.reduce((sum, value, i) => sum + value * sun[i]!, 0);
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return {
    cosine,
    region: cosine > width ? "day" : cosine < -width ? "night" : "twilight",
    day: smooth(-width, width, cosine),
    twilight: 1 - smooth(0, width, Math.abs(cosine)),
    night: 1 - smooth(-width, width * 0.15, cosine),
  };
}

export function twilightReviewView(sun: THREE.Vector3, home: Vec3) {
  // Face a terminator point, with the SAME world sun as Home. Full hemisphere
  // fits inside the stage so all three regions can be sampled away from the rim.
  const direction = new THREE.Vector3(...home);
  direction.addScaledVector(sun, -direction.dot(sun)).normalize();
  return { direction: direction.toArray() as unknown as Vec3, distance: 3.6 };
}

const solarKernel = /* glsl */ `
vec3 solarResponse(float solar) {
  float day = smoothstep(-twilightWidth, twilightWidth, solar);
  float twilight = 1.0 - smoothstep(0.0, twilightWidth, abs(solar));
  float night = 1.0 - smoothstep(-twilightWidth, twilightWidth * .15, solar);
  return vec3(day, twilight, night);
}`;

export const surfaceFragment = /* glsl */ `
uniform sampler2D earth;
uniform sampler2D nightMap;
uniform vec2 nightTexelSize;
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
uniform float solarDiagnostic;
uniform float neutralProbe;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
${solarKernel}
${nightResponseKernel}
${darkCityEmissionKernel}
void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float solar = dot(n, sunDirection);
  vec3 response = solarResponse(solar);
  float day = response.x;
  float twilight = response.y;
  float night = response.z;
  if (solarDiagnostic > .5) {
    // DEV-only categorical geography; deliberately bypass display grading.
    vec3 region = solar > twilightWidth ? vec3(.1,.8,.2) :
                  solar < -twilightWidth ? vec3(.1,.2,.8) : vec3(.9,.3,.1);
    gl_FragColor = vec4(region, 1.0);
    return;
  }

  // Geographic surface: WebGL SRGB8 texture storage decodes exactly once.
  // Preserve Blue Marble RGB, snow texture and bathymetry in LINEAR space.
  vec3 source = texture2D(earth, vUv).rgb;
  float sourceLuminance = dot(source, vec3(.2126,.7152,.0722));
  // Scene-referred reflectance toe expands dark bathymetry/vegetation while
  // preserving RGB ratios and texture. This is material grading, not a second
  // sRGB decode, exposure change, white veil, or theme-dependent fill light.
  source *= pow(max(sourceLuminance, .0001), .65) / max(sourceLuminance, .0001);
  if (neutralProbe > .5) source = vec3(.18);
  float luminance = dot(source, vec3(.2126,.7152,.0722));
  // Blue dominance is a soft REFLECTION weight only, never a land/sea color
  // classification. Even misclassified coastal/snow pixels retain their RGB.
  float oceanReflection = smoothstep(.002,.04, source.b - max(source.r, source.g));

  // Solar illumination: identical energy/terminator for both themes and A/B.
  // Low indirect fill retains readable night terrain without flattening day.
  float diffuse = pow(max(solar, 0.0), .65);
  float illumination = .32 + sunIntensity * diffuse * day;
  vec3 illuminated = source * illumination;

  // Theme grading AFTER lighting: retain local hue and texture differences.
  // Gentle desaturation/cool balance rather than fixed artificial land colors.
  vec3 neutral = vec3(luminance * illumination);
  vec3 lightGrade = mix(illuminated, neutral, .26) * vec3(.88,1.04,1.22);
  vec3 darkGrade = mix(illuminated, neutral, .65) * vec3(.42,.70,1.12);
  vec3 color = mix(lightGrade, darkGrade, dark) * surfaceEnabled;
  float specular = pow(max(dot(n, normalize(sunDirection + view)), 0.0), 90.0);
  color += vec3(.025,.06,.10) * specular * oceanReflection * day * surfaceEnabled;

  // Registered Black Marble is raw grayscale visualization data. Restore
  // peripheral/mid urban detail while retaining the bounded warm-neutral peaks.
  float radiance = texture2D(nightMap, vUv).r;
  float signal = max(radiance - .012, 0.0);
  float lights = cityLightResponse(radiance);
  vec3 warm = mix(vec3(.83,.77,.66), vec3(.96,.90,.79), smoothstep(.1,.8, signal));
  vec3 cityEmission = warm * lights * .45;
  if (dark > .5) cityEmission = darkCityEmission(vUv, radiance, lights);
  color += cityEmission * night * nightIntensity * nightEnabled;

  // Tangent air: true twilight peaks at solar=0, never at midday.
  float grazing = 1.0 - max(dot(n, view), 0.0);
  float rim = pow(grazing, 7.0);
  float sunlitAir = smoothstep(-twilightWidth,.65,solar);
  vec3 scatter = mix(vec3(.002,.007,.018), vec3(.065,.17,.32), sunlitAir);
  scatter += vec3(.18,.19,.20) * twilight * mix(.25,1.0,horizonTwilight);
  color += scatter * rim * atmosphereIntensity * atmosphereEnabled * mix(.65,1.0,dark);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 sunDirection;
uniform float dark;
uniform float twilightWidth;
uniform float atmosphereIntensity;
uniform float horizonTwilight;
varying vec3 vWorldPosition;
${solarKernel}
void main() {
  vec3 ray = normalize(vWorldPosition - cameraPosition);
  float closestT = -dot(cameraPosition, ray);
  vec3 closest = cameraPosition + ray * closestT;
  float altitude = max(length(closest) - 1.0, 0.0);
  float core = exp(-altitude / .0032);
  float skirt = exp(-altitude / .0065) * horizonTwilight * .16;
  float outerFade = 1.0 - smoothstep(.010,.022,altitude);
  float solar = dot(normalize(closest), sunDirection);
  vec3 response = solarResponse(solar);
  float day = smoothstep(-twilightWidth,.65,solar);
  float twilight = response.y;
  float phase = .75 * (1.0 + pow(dot(ray, sunDirection),2.0));
  vec3 color = mix(vec3(.008,.028,.065),vec3(.11,.28,.49),day);
  color += vec3(.18,.19,.20) * twilight * mix(.25,1.0,horizonTwilight);
  float alpha = (core + skirt * twilight) * outerFade * phase * mix(.025,.38,day) * atmosphereIntensity;
  alpha *= mix(.65,1.0,dark);
  gl_FragColor = vec4(color,clamp(alpha,0.0,.45));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
