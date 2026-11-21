import {
  airportStyle,
  hatchTile,
  rgba,
  routeStroke,
} from "../map2d/theme-style";
import { buildMapScene } from "../map2d/scene";
import { traceSegments } from "../map2d/canvas-path";
import { resolveMapTheme } from "../map2d/theme-registry";
import {
  framePoint,
  posterMapFrame,
  posterWorldPaths,
} from "../share/poster-map";
import { NEON_PASSPORT_STATS, SPARSE_ROUTES } from "./sample-network";

export const NEON_POSTER_SIZE = { width: 1080, height: 1350 } as const;

const tokens = resolveMapTheme("neon-aviation").tokens;

export function renderNeonPassport(
  canvas: HTMLCanvasElement,
  scale = 1,
  cjkFontFamily: string = tokens.type.family.label,
): void {
  const pixelScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  canvas.width = Math.round(NEON_POSTER_SIZE.width * pixelScale);
  canvas.height = Math.round(NEON_POSTER_SIZE.height * pixelScale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Neon passport canvas is unavailable.");
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  context.clearRect(0, 0, NEON_POSTER_SIZE.width, NEON_POSTER_SIZE.height);
  drawBackground(context);
  drawAviationBand(context);
  drawWorldMap(context, pixelScale);
  drawSeparator(context);
  drawPosterCopy(context, cjkFontFamily);
  drawStatsTexture(context);
  drawStats(context);
  drawEntryStamp(context);
  drawMrzBand(context);
}

export function createNeonPassportExport(
  scale: number,
  cjkFontFamily: string = tokens.type.family.label,
): string {
  const canvas = document.createElement("canvas");
  renderNeonPassport(canvas, scale, cjkFontFamily);
  return canvas.toDataURL("image/png");
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(
    0,
    0,
    0,
    NEON_POSTER_SIZE.height,
  );
  gradient.addColorStop(0, rgba(tokens.color.backgroundTop));
  gradient.addColorStop(0.48, rgba(tokens.color.ocean));
  gradient.addColorStop(1, rgba(tokens.color.backgroundBottom));
  context.fillStyle = gradient;
  context.fillRect(0, 0, NEON_POSTER_SIZE.width, NEON_POSTER_SIZE.height);
  const bloom = context.createRadialGradient(540, 350, 20, 540, 350, 700);
  bloom.addColorStop(0, rgba(tokens.color.backgroundBloom));
  bloom.addColorStop(1, rgba(tokens.color.backgroundBloom, 0));
  context.fillStyle = bloom;
  context.fillRect(0, 0, NEON_POSTER_SIZE.width, NEON_POSTER_SIZE.height);
}

function drawAviationBand(context: CanvasRenderingContext2D) {
  const hub = posterWaypointCodes()[0] ?? "";
  const gradient = context.createLinearGradient(70, 0, 1010, 0);
  gradient.addColorStop(0, rgba(tokens.color.airportHalo));
  gradient.addColorStop(0.46, rgba(tokens.color.routeFrequent));
  gradient.addColorStop(1, rgba(tokens.color.focus));
  context.font = `600 24px ${tokens.type.family.display}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = gradient;
  for (let index = 0; index < 17; index += 1)
    context.fillText("✈", 95 + index * 55, 55);
  context.font = `600 21px ${tokens.type.family.data}`;
  context.textAlign = "left";
  context.fillText(hub, 72, 93);
  context.textAlign = "right";
  context.fillText(hub, 1008, 93);
  context.textAlign = "left";
}

function posterWaypointCodes(): string[] {
  const counts = new Map<string, number>();
  for (const route of SPARSE_ROUTES) {
    for (const code of [route.origin.iata, route.destination.iata])
      counts.set(code, (counts.get(code) ?? 0) + route.count);
  }
  return [...counts]
    .sort(
      ([leftCode, leftCount], [rightCode, rightCount]) =>
        rightCount - leftCount || leftCode.localeCompare(rightCode),
    )
    .map(([code]) => code);
}

function drawWorldMap(context: CanvasRenderingContext2D, pixelScale: number) {
  const frame = posterMapFrame({ x: 46, y: 132, width: 988, height: 438 }, 0);
  const paths = posterWorldPaths(frame.centerLongitude);
  const land = new Path2D(paths.land);
  context.save();
  context.translate(frame.offsetX, frame.offsetY);
  context.scale(frame.scale, frame.scale);
  context.translate(-frame.extent.x, -frame.extent.y);

  context.fillStyle = rgba(tokens.color.land);
  context.fill(land);
  context.save();
  context.clip(land);
  const pattern = makeHatchPattern(context, pixelScale);
  if (pattern) {
    context.fillStyle = pattern;
    context.fillRect(
      frame.extent.x,
      frame.extent.y,
      frame.extent.width,
      frame.extent.height,
    );
  }
  context.restore();

  context.lineWidth = tokens.line.border;
  context.strokeStyle = rgba(tokens.color.border);
  context.stroke(new Path2D(paths.borders));
  context.lineWidth = tokens.line.coastline;
  context.strokeStyle = rgba(tokens.color.coastline);
  context.stroke(new Path2D(paths.sphere));
  context.restore();

  const scene = buildMapScene({
    routes: SPARSE_ROUTES.map((route) => ({
      origin: route.origin,
      destination: route.destination,
      flightCount: route.count,
    })),
    centerLongitude: frame.centerLongitude,
  });
  for (const route of scene.routes) {
    const stroke = routeStroke(tokens, "base", "normal");
    context.beginPath();
    traceSegments(context, route.segments, (point) => framePoint(frame, point));
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = rgba(tokens.color.routeGlow, tokens.glow.intensity);
    context.lineWidth = stroke.width + tokens.glow.spread * 2;
    context.stroke();
    context.strokeStyle = rgba(stroke.color, stroke.opacity);
    context.lineWidth = stroke.width;
    context.stroke();
  }

  for (const airport of scene.airports) {
    const style = airportStyle(tokens, airport.hub ? "hub" : "base", "normal");
    const point = framePoint(frame, airport);
    context.beginPath();
    context.fillStyle = rgba(tokens.color.airportHalo, 0.18);
    context.arc(point.x, point.y, tokens.airport.hub.halo, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = rgba(style.color, style.opacity);
    context.arc(point.x, point.y, tokens.airport.base.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function makeHatchPattern(
  context: CanvasRenderingContext2D,
  pixelScale: number,
): CanvasPattern | null {
  const tile = hatchTile(tokens.hatch, pixelScale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(tile.size * pixelScale));
  canvas.height = Math.max(1, Math.round(tile.size * pixelScale));
  const tileContext = canvas.getContext("2d");
  if (!tileContext) return null;
  tileContext.scale(pixelScale, pixelScale);
  tileContext.strokeStyle = rgba(tokens.color.landHatch);
  tileContext.lineWidth = tile.lineWidth;
  const radians = (tile.angle * Math.PI) / 180;
  const lineLength = tile.size * Math.SQRT2;
  tileContext.beginPath();
  tileContext.moveTo(0, 0);
  tileContext.lineTo(
    Math.cos(radians) * lineLength,
    Math.sin(radians) * lineLength,
  );
  tileContext.stroke();
  const pattern = context.createPattern(canvas, "repeat");
  pattern?.setTransform({
    a: 1 / pixelScale,
    b: 0,
    c: 0,
    d: 1 / pixelScale,
    e: 0,
    f: 0,
  });
  return pattern;
}

function drawSeparator(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.setLineDash([3, 9]);
  context.strokeStyle = rgba(tokens.color.dateline, 0.6);
  context.lineWidth = 1;
  context.moveTo(64, 603);
  context.lineTo(1016, 603);
  context.stroke();
  context.setLineDash([]);
}

function drawPosterCopy(
  context: CanvasRenderingContext2D,
  cjkFontFamily: string,
) {
  context.fillStyle = rgba(tokens.color.label);
  context.textBaseline = "alphabetic";
  context.font = `700 ${tokens.type.size.posterTitle}px ${tokens.type.family.display}`;
  context.fillText("FLIGHT PASSPORT", 64, 698);
  context.fillStyle = rgba(tokens.color.labelMuted);
  context.font = `500 18px ${tokens.type.family.label}`;
  context.fillText("HOLDER · KEEPRAW TRAVELER · SPECIMEN", 68, 737);
  context.font = `500 18px ${tokens.type.family.label}, ${cjkFontFamily}`;
  context.fillText("PASSPORT · PASSEPORT · 护照", 68, 769);
}

function drawStatsTexture(context: CanvasRenderingContext2D) {
  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = rgba(tokens.color.routeGlow);
  context.lineWidth = 0.8;
  for (let index = 0; index < 12; index += 1) {
    context.beginPath();
    const y = 825 + index * 34;
    context.moveTo(30, y + Math.sin(index * 0.8) * 16);
    for (let x = 30; x <= 1050; x += 12)
      context.lineTo(x, y + Math.sin(x / 72 + index * 0.55) * 12);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.075;
  context.fillStyle = rgba(tokens.color.label);
  context.font = `400 13px ${tokens.type.family.data}`;
  const airportCodes = posterWaypointCodes();
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 12; column += 1)
      context.fillText(
        airportCodes[(row + column) % airportCodes.length] ?? "",
        44 + column * 84,
        832 + row * 42,
      );
  }
  context.restore();
}

function drawStats(context: CanvasRenderingContext2D) {
  const stats = [
    {
      label: "FLIGHTS",
      value: String(NEON_PASSPORT_STATS.flights),
      x: 64,
      y: 858,
      valueY: 920,
    },
    {
      label: "DISTANCE (KM)",
      value: NEON_PASSPORT_STATS.distanceKm.toLocaleString("en-US"),
      x: 400,
      y: 858,
      valueY: 920,
    },
    {
      label: "FLIGHT TIME",
      value: NEON_PASSPORT_STATS.flightTime,
      x: 64,
      y: 1054,
      valueY: 1116,
    },
    {
      label: "AIRPORTS",
      value: String(NEON_PASSPORT_STATS.airports),
      x: 400,
      y: 1054,
      valueY: 1116,
    },
    {
      label: "AIRLINES",
      value: String(NEON_PASSPORT_STATS.airlines),
      x: 736,
      y: 1054,
      valueY: 1116,
    },
  ];
  for (const stat of stats) {
    context.fillStyle = rgba(tokens.color.labelMuted);
    context.font = `600 ${tokens.type.size.statLabel}px ${tokens.type.family.label}`;
    context.letterSpacing = tokens.type.letterSpacing.caps;
    context.fillText(stat.label, stat.x, stat.y);
    context.letterSpacing = "0px";
    context.fillStyle = rgba(tokens.color.label);
    context.font = `600 ${tokens.type.size.statValue}px ${tokens.type.family.display}`;
    context.fillText(stat.value, stat.x, stat.valueY);
  }
}

function drawEntryStamp(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(870, 900);
  context.strokeStyle = rgba(tokens.color.airportHalo, 0.72);
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 72, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(0, 0, 60, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = rgba(tokens.color.airportHalo);
  context.textAlign = "center";
  context.font = `600 17px ${tokens.type.family.data}`;
  context.fillText("SPECIMEN ENTRY", 0, -18);
  context.font = `600 28px ${tokens.type.family.display}`;
  context.fillText("✈", 0, 20);
  context.font = `500 13px ${tokens.type.family.data}`;
  context.fillText("17 MAY 2026", 0, 48);
  context.restore();
}

function drawMrzBand(context: CanvasRenderingContext2D) {
  context.fillStyle = rgba(tokens.color.labelHalo, 0.72);
  context.fillRect(0, 1194, NEON_POSTER_SIZE.width, 156);
  context.fillStyle = rgba(tokens.color.label);
  context.font = `400 27px ${tokens.type.family.data}`;
  context.fillText("P<KRF<<KEEPRAW<TRAVELER<<<<<<<<<<<<<<<<<<<<", 36, 1258);
  context.fillText("SPECIMEN<<NEON<AVIATION<<<<<<<<<<<<<<<<<<<<", 36, 1308);
}
