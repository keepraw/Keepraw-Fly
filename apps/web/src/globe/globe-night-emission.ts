// Dark-only city appearance. Every lobe comes from registered NASA samples;
// separate quiet urban fabric from compact luminous cores and nearby spill.
export const darkCityEmissionKernel = /* glsl */ `
vec3 darkCityEmission(vec2 uv, float radiance, float fabric) {
  vec2 stepUv = nightTexelSize;
  float north = texture2D(nightMap, uv + vec2(0.0, stepUv.y)).r;
  float south = texture2D(nightMap, uv - vec2(0.0, stepUv.y)).r;
  float east = texture2D(nightMap, uv + vec2(stepUv.x, 0.0)).r;
  float west = texture2D(nightMap, uv - vec2(stepUv.x, 0.0)).r;
  float surround = (north + south + east + west) * .25;
  float localPeak = smoothstep(.0, .30, max(radiance - surround, 0.0));
  // Preserve raw spatial rank in bright districts rather than displaying the
  // shoulder-compressed signal as an almost uniform gray reflectance patch.
  float core = pow(max(radiance - .012, 0.0) / .988, 3.0) * mix(.12, 1.0, localPeak);
  float spill = (pow(max(north - .012, 0.0) / .988, 4.0) +
                 pow(max(south - .012, 0.0) / .988, 4.0) +
                 pow(max(east - .012, 0.0) / .988, 4.0) +
                 pow(max(west - .012, 0.0) / .988, 4.0)) * .25;
  return vec3(1.35,.83,.42) * fabric * mix(.35, .65, localPeak) +
         vec3(1.0,.84,.62) * core * .28 +
         vec3(1.0,.58,.25) * spill * .018;
}`;
