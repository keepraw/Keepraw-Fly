import type { Vec3 } from "./globe-math";
import { spherePoint } from "./globe-math";

export type SolarMode = "fixed" | "realtime";

/**
 * Fixed world-space sun for the DEV-only Globe Lab baseline.
 * Independent of camera, routes, filtering and UI theme.
 * Preserves the historical Demo direction from Task 1B-6.
 */
export const FIXED_SUN_DIRECTION: Vec3 = [
  -0.2926889023874383, 0.290121517531001, 0.9111326530669097,
];

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function wrapDegrees360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function wrapLongitude(longitude: number): number {
  let wrapped = (((longitude + 180) % 360) + 360) % 360;
  return wrapped - 180;
}

/**
 * Subsolar geographic point for an absolute UTC instant.
 * The input Date is interpreted via getTime() (UTC epoch ms), so the result
 * is identical regardless of the browser's local timezone.
 *
 * Low-precision NOAA/Meeus approximation: mean longitude + anomaly,
 * ecliptic longitude, axial tilt (obliquity), declination, right ascension,
 * GMST, then subsolar longitude = RA - GMST. Covers seasonal declination
 * and daily rotation without external time services.
 */
export function solarSubpointFromUtc(instant: Date): {
  latitude: number;
  longitude: number;
} {
  const jd = instant.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const meanLongitude = wrapDegrees360(280.46 + 0.9856474 * n);
  const meanAnomaly = wrapDegrees360(357.528 + 0.9856003 * n);
  const anomalyRad = meanAnomaly * DEG;
  const eclipticLongitude =
    meanLongitude +
    1.915 * Math.sin(anomalyRad) +
    0.02 * Math.sin(2 * anomalyRad);
  const eclipticRad = eclipticLongitude * DEG;
  const obliquity = 23.439 - 0.0000004 * n;
  const obliquityRad = obliquity * DEG;
  const declination = Math.asin(
    Math.max(-1, Math.min(1, Math.sin(obliquityRad) * Math.sin(eclipticRad))),
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquityRad) * Math.sin(eclipticRad),
    Math.cos(eclipticRad),
  );
  const rightAscensionDeg = wrapDegrees360((rightAscension / TAU) * 360);
  const gmstDeg = wrapDegrees360(280.46061837 + 360.98564736629 * n);
  const longitude = wrapLongitude(rightAscensionDeg - gmstDeg);
  return { latitude: declination / DEG, longitude };
}

/**
 * World-space sun direction in the existing sphere coordinate system
 * (see spherePoint in globe-math.ts). Unit length.
 */
export function solarDirectionFromUtc(instant: Date): Vec3 {
  const subpoint = solarSubpointFromUtc(instant);
  return spherePoint({
    latitude: subpoint.latitude,
    longitude: subpoint.longitude,
  });
}

/** Milliseconds from the instant until the next UTC minute boundary. */
export function msUntilNextUtcMinute(instant: Date): number {
  const ms = instant.getTime();
  return 60000 - (ms % 60000);
}
