import type { RoutePoint } from "@keepraw-fly/core";

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 480;

export interface GeographicPoint {
  longitude: number;
  latitude: number;
}

export const worldLandShapes: GeographicPoint[][] = [
  // North and Central America
  [[-168, 72], [-148, 70], [-136, 59], [-126, 53], [-124, 45], [-117, 32], [-108, 25], [-98, 20], [-90, 21], [-86, 16], [-82, 9], [-77, 8], [-79, 20], [-81, 26], [-75, 36], [-66, 45], [-60, 52], [-65, 61], [-86, 66], [-98, 75], [-126, 75], [-150, 73]],
  // Greenland
  [[-73, 59], [-49, 60], [-22, 70], [-25, 82], [-48, 84], [-67, 77]],
  // South America
  [[-81, 12], [-70, 11], [-60, 7], [-50, 2], [-35, -7], [-40, -20], [-49, -29], [-54, -43], [-68, -55], [-75, -42], [-80, -20], [-79, 0]],
  // Europe
  [[-11, 36], [-10, 44], [-5, 50], [5, 54], [10, 61], [20, 70], [31, 70], [39, 59], [34, 51], [25, 45], [16, 39], [5, 42]],
  // Africa
  [[-17, 36], [5, 37], [20, 33], [33, 31], [43, 12], [51, 10], [42, -11], [34, -26], [20, -35], [8, -34], [-5, -20], [-17, 5]],
  // Asia
  [[30, 70], [60, 76], [98, 77], [135, 70], [177, 62], [163, 51], [145, 45], [141, 35], [126, 22], [113, 7], [103, 2], [98, 15], [88, 22], [72, 25], [56, 28], [45, 36], [35, 47], [40, 61]],
  // Arabian Peninsula and India
  [[34, 31], [48, 30], [57, 22], [50, 12], [43, 13]],
  [[67, 25], [78, 8], [88, 22], [80, 30]],
  // Southeast Asia
  [[96, 22], [107, 20], [121, 8], [114, -7], [103, 2]],
  // Japan
  [[129, 32], [134, 35], [141, 44], [145, 43], [140, 34]],
  // Indonesia
  [[95, 5], [112, 1], [129, -4], [141, -8], [130, -10], [112, -7]],
  // Australia
  [[112, -11], [130, -12], [145, -18], [154, -28], [148, -39], [130, -35], [116, -29]],
  // New Zealand
  [[166, -34], [177, -38], [174, -47], [168, -45]],
  // United Kingdom and Iceland
  [[-8, 50], [2, 51], [0, 58], [-6, 59]],
  [[-24, 63], [-13, 64], [-14, 67], [-22, 67]],
  // Madagascar
  [[47, -13], [51, -16], [49, -26], [44, -24]],
  // Antarctica
  [[-180, -70], [-120, -73], [-60, -72], [0, -76], [60, -73], [120, -75], [180, -70], [180, -90], [-180, -90]],
].map((shape) => shape.map((point) => ({
  longitude: point[0]!,
  latitude: point[1]!,
})));

export function projectPoint(point: GeographicPoint) {
  return {
    x: ((point.longitude + 180) / 360) * WORLD_WIDTH,
    y: ((90 - point.latitude) / 180) * WORLD_HEIGHT,
  };
}

export function polygonPoints(shape: GeographicPoint[]): string {
  return shape.map((point) => {
    const projected = projectPoint(point);
    return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
  }).join(" ");
}

export function greatCirclePath(origin: RoutePoint, destination: RoutePoint, steps = 40): string {
  const start = toVector(origin);
  const end = toVector(destination);
  const dot = clamp(start.x * end.x + start.y * end.y + start.z * end.z, -1, 1);
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const commands: string[] = [];
  let previousX: number | undefined;

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const firstWeight = sinAngle < 0.000001
      ? 1 - progress
      : Math.sin((1 - progress) * angle) / sinAngle;
    const secondWeight = sinAngle < 0.000001
      ? progress
      : Math.sin(progress * angle) / sinAngle;
    const vector = normalize({
      x: firstWeight * start.x + secondWeight * end.x,
      y: firstWeight * start.y + secondWeight * end.y,
      z: firstWeight * start.z + secondWeight * end.z,
    });
    const point = projectPoint({
      longitude: radiansToDegrees(Math.atan2(vector.y, vector.x)),
      latitude: radiansToDegrees(Math.asin(vector.z)),
    });
    const command = previousX !== undefined && Math.abs(point.x - previousX) > WORLD_WIDTH / 2
      ? "M"
      : commands.length ? "L" : "M";
    commands.push(`${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`);
    previousX = point.x;
  }
  return commands.join(" ");
}

function toVector(point: GeographicPoint) {
  const latitude = degreesToRadians(point.latitude);
  const longitude = degreesToRadians(point.longitude);
  return {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

function normalize(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function degreesToRadians(value: number) { return value * Math.PI / 180; }
function radiansToDegrees(value: number) { return value * 180 / Math.PI; }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
