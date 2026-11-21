import {
  NEON_AVIATION,
  hatchTile,
  rgba,
  routeStroke,
} from "./neon-aviation-tokens";
import {
  posterMapFrame,
  posterWorldPaths,
  projectToFrame,
  routePolylines,
} from "../share/poster-map";
import {
  NEON_AIRPORTS,
  NEON_PASSPORT_STATS,
  SPARSE_ROUTES,
} from "./sample-network";

export const NEON_POSTER_SIZE = { width: 1080, height: 1350 } as const;

export function renderNeonPassport(canvas: HTMLCanvasElement, scale = 1): void {
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
  drawPosterCopy(context);
  drawStatsTexture(context);
  drawStats(context);
  drawEntryStamp(context);
  drawSpecimenBand(context);
}

export function createNeonPassportExport(scale: number): string {
  const canvas = document.createElement("canvas");
  renderNeonPassport(canvas, scale);
  return canvas.toDataURL("image/png");
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(
    0,
    0,
    0,
    NEON_POSTER_SIZE.height,
  );
  gradient.addColorStop(0, rgba(NEON_AVIATION.color.backgroundTop));
  gradient.addColorStop(0.48, rgba(NEON_AVIATION.color.ocean));
  gradient.addColorStop(1, rgba(NEON_AVIATION.color.backgroundBottom));
  context.fillStyle = gradient;
  context.fillRect(0, 0, NEON_POSTER_SIZE.width, NEON_POSTER_SIZE.height);
  const bloom = context.createRadialGradient(540, 350, 20, 540, 350, 700);
  bloom.addColorStop(0, rgba(NEON_AVIATION.color.backgroundBloom));
  bloom.addColorStop(1, rgba(NEON_AVIATION.color.backgroundBloom, 0));
  context.fillStyle = bloom;
  context.fillRect(0, 0, NEON_POSTER_SIZE.width, NEON_POSTER_SIZE.height);
}

function drawAviationBand(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(70, 0, 1010, 0);
  gradient.addColorStop(0, rgba(NEON_AVIATION.color.airportHalo));
  gradient.addColorStop(0.46, rgba(NEON_AVIATION.color.routeFrequent));
  gradient.addColorStop(1, rgba(NEON_AVIATION.color.focus));
  context.font = `600 24px ${NEON_AVIATION.type.family.display}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = gradient;
  for (let index = 0; index < 17; index += 1)
    context.fillText("✈", 95 + index * 55, 55);
  context.font = `600 21px ${NEON_AVIATION.type.family.data}`;
  context.textAlign = "left";
  context.fillText("TPE", 72, 93);
  context.textAlign = "right";
  context.fillText("LAX", 1008, 93);
  context.textAlign = "left";
}

function drawWorldMap(context: CanvasRenderingContext2D, pixelScale: number) {
  const frame = posterMapFrame({ x: 46, y: 132, width: 988, height: 438 }, 0);
  const paths = posterWorldPaths(frame.centerLongitude);
  const land = new Path2D(paths.land);
  context.save();
  context.translate(frame.offsetX, frame.offsetY);
  context.scale(frame.scale, frame.scale);
  context.translate(-frame.extent.x, -frame.extent.y);

  context.fillStyle = rgba(NEON_AVIATION.color.land);
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

  context.lineWidth = NEON_AVIATION.line.border;
  context.strokeStyle = rgba(NEON_AVIATION.color.border);
  context.stroke(new Path2D(paths.borders));
  context.lineWidth = NEON_AVIATION.line.coastline;
  context.strokeStyle = rgba(NEON_AVIATION.color.coastline);
  context.stroke(new Path2D(paths.sphere));
  context.restore();

  for (const route of SPARSE_ROUTES) {
    const stroke = routeStroke("base", "normal");
    const lines = routePolylines(frame, route.origin, route.destination);
    for (const line of lines) {
      if (line.length < 2) continue;
      context.beginPath();
      context.moveTo(line[0]!.x, line[0]!.y);
      for (const point of line.slice(1)) context.lineTo(point.x, point.y);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = rgba(
        NEON_AVIATION.color.routeGlow,
        NEON_AVIATION.glow.intensity,
      );
      context.lineWidth = stroke.width + NEON_AVIATION.glow.spread * 2;
      context.stroke();
      context.strokeStyle = rgba(stroke.color, stroke.opacity);
      context.lineWidth = stroke.width;
      context.stroke();
    }
  }

  const airportCodes = new Set(
    SPARSE_ROUTES.flatMap((route) => [
      route.origin.iata,
      route.destination.iata,
    ]),
  );
  for (const airport of NEON_AIRPORTS) {
    if (!airportCodes.has(airport.iata)) continue;
    const point = projectToFrame(frame, airport);
    if (!point) continue;
    context.beginPath();
    context.fillStyle = rgba(NEON_AVIATION.color.airportHalo, 0.18);
    context.arc(
      point.x,
      point.y,
      NEON_AVIATION.airport.hub.halo,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.beginPath();
    context.fillStyle = rgba(NEON_AVIATION.color.airport);
    context.arc(
      point.x,
      point.y,
      NEON_AVIATION.airport.base.radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function makeHatchPattern(
  context: CanvasRenderingContext2D,
  pixelScale: number,
): CanvasPattern | null {
  const tile = hatchTile(NEON_AVIATION.hatch, pixelScale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(tile.size * pixelScale));
  canvas.height = Math.max(1, Math.round(tile.size * pixelScale));
  const tileContext = canvas.getContext("2d");
  if (!tileContext) return null;
  tileContext.scale(pixelScale, pixelScale);
  tileContext.strokeStyle = rgba(NEON_AVIATION.color.landHatch);
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
  context.strokeStyle = rgba(NEON_AVIATION.color.dateline, 0.6);
  context.lineWidth = 1;
  context.moveTo(64, 603);
  context.lineTo(1016, 603);
  context.stroke();
  context.setLineDash([]);
}

function drawPosterCopy(context: CanvasRenderingContext2D) {
  context.fillStyle = rgba(NEON_AVIATION.color.label);
  context.textBaseline = "alphabetic";
  context.font = `700 84px ${NEON_AVIATION.type.family.display}`;
  context.fillText("KEEPRAW TRAVELER", 64, 705);
  context.fillStyle = rgba(NEON_AVIATION.color.labelMuted);
  context.font = `500 18px ${NEON_AVIATION.type.family.label}`;
  context.fillText("SPECIMEN · NEON AVIATION · FICTIONAL PASSPORT", 68, 744);
}

function drawStatsTexture(context: CanvasRenderingContext2D) {
  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = rgba(NEON_AVIATION.color.routeGlow);
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
  context.fillStyle = rgba(NEON_AVIATION.color.label);
  context.font = `400 13px ${NEON_AVIATION.type.family.data}`;
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 12; column += 1)
      context.fillText(
        ["TPE", "LAX", "PVG", "CDG", "SIN", "NRT"][(row + column) % 6]!,
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
      y: 832,
    },
    {
      label: "DISTANCE (KM)",
      value: NEON_PASSPORT_STATS.distanceKm.toLocaleString("en-US"),
      x: 555,
      y: 832,
    },
    {
      label: "FLIGHT TIME",
      value: NEON_PASSPORT_STATS.flightTime,
      x: 64,
      y: 1032,
    },
    {
      label: "AIRPORTS",
      value: String(NEON_PASSPORT_STATS.airports),
      x: 555,
      y: 1032,
    },
    {
      label: "AIRLINES",
      value: String(NEON_PASSPORT_STATS.airlines),
      x: 64,
      y: 1192,
    },
  ];
  for (const stat of stats) {
    context.fillStyle = rgba(NEON_AVIATION.color.labelMuted);
    context.font = `600 15px ${NEON_AVIATION.type.family.label}`;
    context.letterSpacing = NEON_AVIATION.type.letterSpacing.caps;
    context.fillText(stat.label, stat.x, stat.y);
    context.letterSpacing = "0px";
    context.fillStyle = rgba(NEON_AVIATION.color.label);
    context.font = `600 56px ${NEON_AVIATION.type.family.display}`;
    context.fillText(stat.value, stat.x, stat.y + 66);
  }
}

function drawEntryStamp(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(870, 1080);
  context.strokeStyle = rgba(NEON_AVIATION.color.airportHalo, 0.72);
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 86, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(0, 0, 72, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = rgba(NEON_AVIATION.color.airportHalo);
  context.textAlign = "center";
  context.font = `600 17px ${NEON_AVIATION.type.family.data}`;
  context.fillText("SPECIMEN ENTRY", 0, -18);
  context.font = `600 28px ${NEON_AVIATION.type.family.display}`;
  context.fillText("✈", 0, 20);
  context.font = `500 13px ${NEON_AVIATION.type.family.data}`;
  context.fillText("17 MAY 2026", 0, 48);
  context.restore();
}

function drawSpecimenBand(context: CanvasRenderingContext2D) {
  context.fillStyle = rgba(NEON_AVIATION.color.labelHalo, 0.55);
  context.fillRect(40, 1268, 1000, 57);
  context.fillStyle = rgba(NEON_AVIATION.color.label);
  context.font = `400 14px ${NEON_AVIATION.type.family.data}`;
  context.fillText("P<KRF<<KEEPRAW<TRAVELER<<<<<<<<<<<<<<<<<<", 58, 1291);
  context.fillText("SPECIMEN<<NEON<AVIATION<<<<<<<<<<<<<<<<<<", 58, 1313);
}
