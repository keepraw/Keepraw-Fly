// Black Marble is historical grayscale visualization data, not physical radiance.
// Keep the measured background floor. Separate the low roll-in, midtone scale,
// and maximum emission so restoring peripheries never raises city-core peaks.
export const nightResponseParameters = {
  floor: 0.012,
  toeWidth: 0.035,
  shoulder: 0.12,
  peak: 0.1044,
} as const;

export function nightResponse(input: number): number {
  const { floor, toeWidth, shoulder, peak } = nightResponseParameters;
  const signal = Math.max(0, Math.min(1, input) - floor);
  const t = Math.min(1, signal / toeWidth);
  const toe = t * t * (3 - 2 * t);
  return (
    ((peak * (1 + shoulder / (1 - floor)) * signal) / (shoulder + signal)) * toe
  );
}

const { floor, toeWidth, shoulder, peak } = nightResponseParameters;
// Same parameters and arithmetic as the CPU reference; no extra texture lookup.
export const nightResponseKernel = /* glsl */ `
float cityLightResponse(float inputSignal) {
  float signal = max(inputSignal - ${floor}, 0.0);
  float toe = smoothstep(0.0, ${toeWidth}, signal);
  return ${peak} * (1.0 + ${shoulder} / (1.0 - ${floor})) *
         signal / (${shoulder} + signal) * toe;
}`;
