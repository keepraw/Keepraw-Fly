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

  // Solar illumination ARCHITECTURE (shared energy/terminator for both themes, A/B):
  // - Direct key: photographic contrast exponent (.72) with ocean-absorbed response
  //   (oceans keep 0.80x direct vs land) to separate land/ocean materials.
  // - Indirect fill: twilight-aware hemisphere (night .36, day .58, +0.12 twilight
  //   lift) instead of a flat constant. Lifts terminator readability where texture
  //   was muddy while keeping deep night darker for city contrast. Identical for
  //   Light/Dark and A/B; themes grade AFTER this shared lighting.
  float diffuse = pow(max(solar, 0.0), 0.72);
  float directEnergy = sunIntensity * diffuse * day;
  float indirect = mix(0.36, 0.58, day) + 0.12 * twilight * (1.0 - day * 0.5);
  float oceanDiffuseScale = mix(1.0, 0.80, oceanReflection);
  vec3 illuminated = source * (indirect + directEnergy * oceanDiffuseScale);

  // Theme grading AFTER lighting: luminance-dependent desaturation plus
  // material-aware balances. Shadows stay deep navy while mid/high terrain
  // retains hue and texture — not a global wash or second gamma decode.
  // Light keeps land near-neutral and gives oceans a controlled blue; Dark lifts
  // land red (readable warm terrain) while oceans stay navy. Preserves RGB ratios.
  float illumLuminance = dot(illuminated, vec3(.2126,.7152,.0722));
  vec3 neutralLit = vec3(illumLuminance);
  float lightDesat = mix(0.30, 0.12, smoothstep(0.03, 0.35, luminance));
  float darkDesat = mix(0.68, 0.38, smoothstep(0.02, 0.28, luminance));
  vec3 lightBalance = mix(vec3(0.98,1.015,1.06), vec3(0.84,0.99,1.14), oceanReflection);
  vec3 darkBalance = mix(vec3(0.58,0.78,1.02), vec3(0.40,0.66,1.06), oceanReflection);
  vec3 lightGrade = mix(illuminated, neutralLit, lightDesat) * lightBalance;
  vec3 darkGrade = mix(illuminated, neutralLit, darkDesat) * darkBalance;
  vec3 color = mix(lightGrade, darkGrade, dark) * surfaceEnabled;
  // Ocean material response: view-dependent sky sheen plus a sharp warm sun glint.
  // Both are ocean-selective and day-modulated — photographic fresnel luminosity
  // for Light oceans without uniform cobalt heaviness, subtle depth in Dark.
  vec3 halfVec = normalize(sunDirection + view);
  float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
  float skySheen = fresnel * oceanReflection * day * (0.30 + 0.70 * diffuse);
  color += vec3(0.20,0.42,0.68) * skySheen * 0.28 * surfaceEnabled;
  float glint = pow(max(dot(n, halfVec), 0.0), 220.0);
  color += vec3(1.0,0.86,0.66) * glint * oceanReflection * day * 0.38 * surfaceEnabled;

  // Registered Black Marble is raw grayscale visualization data. Restore
  // peripheral/mid urban detail while retaining the bounded warm-neutral peaks.
  float radiance = texture2D(nightMap, vUv).r;
  float signal = max(radiance - .012, 0.0);
  float lights = cityLightResponse(radiance);
  vec3 warm = mix(vec3(.83,.77,.66), vec3(.96,.90,.79), smoothstep(.1,.8, signal));
  vec3 cityEmission = warm * lights * .45;
  if (dark > .5) cityEmission = darkCityEmission(vUv, radiance, lights);
  color += cityEmission * night * nightIntensity * nightEnabled;

  // Concentrated tangent air: no night halo so the backlit limb falls away.
  // Day-side blue plus a warm twilight focus that peaks at solar=0, never midday.
  // A/B only scales the twilight shoulder; sun/terminator stay identical.
  float grazing = 1.0 - max(dot(n, view), 0.0);
  float rim = pow(grazing, 6.0);
  float limbDay = smoothstep(-twilightWidth * 0.35, 0.65, solar);
  vec3 limbScatter = vec3(0.055,0.15,0.30) * limbDay;
  limbScatter += vec3(0.20,0.16,0.11) * twilight * mix(0.35,1.0,horizonTwilight);
  color += limbScatter * rim * atmosphereIntensity * atmosphereEnabled * mix(0.60,1.0,dark);
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
  // Concentrated shell: tight night cutoff (no uniform halo), forward-scattered
  // lobe toward the sun azimuth for cinematic depth. Same terminator/energy basis
  // as the surface; A/B only scales the twilight shoulder and narrow skirt.
  float day = smoothstep(-twilightWidth * 0.5,.65,solar);
  float twilight = response.y;
  float mu = dot(ray, sunDirection);
  float forwardLobe = 0.35 + 0.95 * pow(max(mu, 0.0), 3.0);
  vec3 color = mix(vec3(0.0),vec3(.10,.26,.46),day);
  color += vec3(.20,.17,.13) * twilight * mix(.30,1.0,horizonTwilight);
  float alpha = (core + skirt * twilight) * outerFade * forwardLobe * mix(.0,.40,pow(day,1.25)) * atmosphereIntensity;
  alpha *= mix(.60,1.0,dark);
  gl_FragColor = vec4(color,clamp(alpha,0.0,.45));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
