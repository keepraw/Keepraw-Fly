import type { RoutePoint } from "@keepraw-fly/core";
import { traceSegments } from "../map2d/canvas-path";
import { buildMapScene } from "../map2d/scene";
import type { MapTheme, MapThemeTokens } from "../map2d/theme";
import { hatchTile, rgba, routeStroke } from "../map2d/theme-style";
import type { PosterCopy, PosterStat } from "./poster-copy";
import type { PosterFonts } from "./poster-fonts";
import type { PosterRect } from "./poster-layout";
import {
  framePoint,
  posterMapFrame,
  posterWorldPaths,
  projectToFrame,
} from "./poster-map";
import {
  Painter,
  drawMrzRows,
  label,
  plane,
  type Context2D,
  type PosterDrawReport,
  type PosterTextBox,
  type TextStyle,
} from "./poster-paint";
import type { ShareGeoPoint } from "./share-model";
import { shareGraphemes } from "./share-text";

/**
 * Neon Flight Passport: the 4:5 single-sheet layout approved in the design
 * phase, drawn from the real `PosterCopy`. Colours, strokes and airport
 * styles come from the active map theme; route geometry comes from the shared
 * 2D scene. No text width is assumed: every string is measured, shrunk, and
 * (labels, holder name) wrapped before it is drawn, so short CJK labels and
 * long European ones use the same grid.
 */
export interface NeonStatCell {
  x: number;
  width: number;
  /** Baseline of the label's last line. */
  label: number;
  baseline: number;
}

export interface NeonPassportLayout {
  width: number;
  height: number;
  safe: PosterRect;
  /** Text may not leave this box (MRZ excepted, which has `mrz.print`). */
  content: PosterRect;
  band: { planes: number; baseline: number; size: number };
  map: PosterRect;
  separator: number;
  title: { baseline: number; size: number; minSize: number };
  name: {
    label: number;
    baseline: number;
    size: number;
    minSize: number;
    lineHeight: number;
  };
  fields: NeonStatCell[];
  fieldSize: number;
  labelSize: number;
  stats: NeonStatCell[];
  statSize: number;
  unitSize: number;
  stamp: PosterRect;
  mrz: {
    area: PosterRect;
    print: PosterRect;
    x: number;
    baseline: number;
    lineHeight: number;
    size: number;
    cellAdvance: number;
  };
}

export const NEON_PASSPORT_SIZE = { width: 1080, height: 1350 } as const;
const MRZ_CELLS = 44;

export function createNeonPassportLayout(): NeonPassportLayout {
  const { width, height } = NEON_PASSPORT_SIZE;
  const left = 64;
  const right = width - left;
  const gap = 36;
  const column = (right - left - gap * 2) / 3;
  const columns = [0, 1, 2].map((index) => left + index * (column + gap));
  const row = (label: number, value: number): NeonStatCell[] =>
    columns.map((x) => ({ x, width: column, label, baseline: label + value }));
  const statRows = [0, 1, 2].flatMap((index) => row(916 + index * 106, 54));
  const mrzTop = 1218;
  const mrzInset = 40;
  const last = statRows.at(-1)!;
  return {
    width,
    height,
    safe: { x: 36, y: 24, width: width - 72, height: height - 48 },
    content: { x: left, y: 36, width: right - left, height: mrzTop - 36 },
    band: { planes: 56, baseline: 100, size: 20 },
    map: { x: 46, y: 126, width: width - 92, height: 438 },
    separator: 598,
    title: { baseline: 682, size: 84, minSize: 44 },
    name: { label: 724, baseline: 762, size: 32, minSize: 20, lineHeight: 26 },
    fields: row(808, 30),
    fieldSize: 22,
    labelSize: 14,
    // Seven statistics; the eighth cell and ninth cell hold the span and stamp.
    stats: statRows,
    statSize: 52,
    unitSize: 20,
    stamp: { x: last.x, y: last.label - 20, width: last.width, height: 86 },
    mrz: {
      area: { x: 0, y: mrzTop, width, height: height - mrzTop },
      print: {
        x: mrzInset - 4,
        y: mrzTop + 8,
        width: width - (mrzInset - 4) * 2,
        height: height - mrzTop - 16,
      },
      x: mrzInset,
      baseline: mrzTop + 56,
      lineHeight: 46,
      size: 28,
      cellAdvance: (width - mrzInset * 2) / MRZ_CELLS,
    },
  };
}

function background(
  context: Context2D,
  layout: NeonPassportLayout,
  tokens: MapThemeTokens,
) {
  const { width, height } = layout;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgba(tokens.color.backgroundTop));
  gradient.addColorStop(0.48, rgba(tokens.color.ocean));
  gradient.addColorStop(1, rgba(tokens.color.backgroundBottom));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = layout.map.y + layout.map.height / 2;
  const bloom = context.createRadialGradient(cx, cy, 20, cx, cy, 700);
  bloom.addColorStop(0, rgba(tokens.color.backgroundBloom));
  bloom.addColorStop(1, rgba(tokens.color.backgroundBloom, 0));
  context.fillStyle = bloom;
  context.fillRect(0, 0, width, height);
}

function aviationBand(
  painter: Painter,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  tokens: MapThemeTokens,
) {
  const { context } = painter;
  const { content, band } = layout;
  const count = 17;
  const stops = [
    tokens.color.airportHalo,
    tokens.color.routeFrequent,
    tokens.color.focus,
  ];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const from = stops[t < 0.5 ? 0 : 1]!;
    const to = stops[t < 0.5 ? 1 : 2]!;
    const k = t < 0.5 ? t * 2 : t * 2 - 2 * 0.5;
    const mix = from.map(
      (channel, at) => channel + (to[at]! - channel) * k,
    ) as unknown as typeof from;
    plane(
      context,
      content.x + 22 + t * (content.width - 44),
      band.planes,
      11,
      Math.PI / 2,
      rgba([
        Math.round(mix[0]),
        Math.round(mix[1]),
        Math.round(mix[2]),
        mix[3],
      ]),
    );
  }
  const half = content.width / 2 - 16;
  painter.text(copy.brand.toLocaleUpperCase(), content.x, band.baseline, {
    size: band.size,
    weight: 600,
    font: "brand",
    color: rgba(tokens.color.label),
    letterSpacing: band.size * 0.14,
    maxWidth: half,
    minSize: 14,
  });
  if (copy.span)
    painter.text(copy.span.value, content.x + content.width, band.baseline, {
      size: band.size,
      font: "mono",
      color: rgba(tokens.color.labelMuted),
      align: "right",
      maxWidth: half,
      minSize: 14,
    });
}

function hatchPattern(
  context: Context2D,
  tokens: MapThemeTokens,
  pixelScale: number,
  mapScale: number,
): CanvasPattern | null {
  const tile = hatchTile(tokens.hatch, pixelScale);
  const pixels = Math.max(2, Math.round(tile.size * pixelScale));
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(pixels, pixels)
      : Object.assign(document.createElement("canvas"), {
          width: pixels,
          height: pixels,
        });
  const tileContext = canvas.getContext("2d") as Context2D | null;
  if (!tileContext) return null;
  tileContext.strokeStyle = rgba(tokens.color.landHatch);
  tileContext.lineWidth = Math.max(1, tile.lineWidth * pixelScale);
  tileContext.lineCap = "square";
  // One diagonal plus its wrapped corners, so the tile repeats seamlessly.
  const down = Math.sin((tile.angle * Math.PI) / 180) >= 0;
  tileContext.beginPath();
  for (const offset of [-pixels, 0, pixels]) {
    tileContext.moveTo(offset, down ? 0 : pixels);
    tileContext.lineTo(offset + pixels, down ? pixels : 0);
  }
  tileContext.stroke();
  const pattern = context.createPattern(canvas, "repeat");
  // Device-pixel tile, independent of the map transform it is filled under.
  const unit = 1 / (pixelScale * mapScale);
  pattern?.setTransform({ a: unit, b: 0, c: 0, d: unit, e: 0, f: 0 });
  return pattern;
}

const routePoint = (point: ShareGeoPoint): RoutePoint => ({
  iata: "",
  // The poster model carries coordinates only (no codes); two routes meet at
  // one airport exactly when they share its coordinates.
  identityKey: `${point.latitude},${point.longitude}`,
  latitude: point.latitude,
  longitude: point.longitude,
});

function worldMap(
  context: Context2D,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  tokens: MapThemeTokens,
  pixelScale: number,
): PosterDrawReport["map"] {
  const frame = posterMapFrame(layout.map, copy.map.centerLongitude);
  const world = posterWorldPaths(frame.centerLongitude);
  const s = frame.scale;
  context.save();
  context.translate(frame.offsetX, frame.offsetY);
  context.scale(s, s);
  context.translate(-frame.extent.x, -frame.extent.y);
  // Fresh Path2D objects per draw: WebKit crashes when one is reused.
  context.save();
  context.clip(new Path2D(world.sphere));
  context.strokeStyle = rgba(tokens.color.graticule);
  context.lineWidth = tokens.line.graticule / s;
  context.stroke(new Path2D(world.graticule));
  context.restore();
  context.fillStyle = rgba(tokens.color.land);
  context.fill(new Path2D(world.land));
  const pattern = hatchPattern(context, tokens, pixelScale, s);
  if (pattern) {
    context.save();
    context.clip(new Path2D(world.land));
    context.fillStyle = pattern;
    context.fillRect(
      frame.extent.x,
      frame.extent.y,
      frame.extent.width,
      frame.extent.height,
    );
    context.restore();
  }
  context.lineJoin = "round";
  context.lineWidth = tokens.line.border / s;
  context.strokeStyle = rgba(tokens.color.border);
  context.stroke(new Path2D(world.borders));
  context.lineWidth = tokens.line.coastline / s;
  context.strokeStyle = rgba(tokens.color.coastline);
  context.stroke(new Path2D(world.sphere));
  context.restore();

  const scene = buildMapScene({
    routes: copy.map.routes.map((route) => ({
      origin: routePoint(route.from),
      destination: routePoint(route.to),
      flightCount: route.flights,
    })),
    centerLongitude: frame.centerLongitude,
  });
  // Dense archives get quieter strokes so crossings stay legible; only the
  // busiest few keep a glow (layered strokes, never a blur filter).
  const density = Math.min(1, Math.sqrt(16 / Math.max(1, scene.routes.length)));
  context.lineCap = "round";
  context.lineJoin = "round";
  let routes = 0;
  for (const route of scene.routes) {
    if (!route.segments.some((segment) => segment.length > 1)) continue;
    routes += 1;
    const stroke = routeStroke(tokens, route.tier, "normal");
    context.beginPath();
    traceSegments(context, route.segments, (point) => framePoint(frame, point));
    if (route.rank < tokens.glow.maxGlowingRoutes) {
      context.strokeStyle = rgba(tokens.color.routeGlow, tokens.glow.intensity);
      context.lineWidth = stroke.width + tokens.glow.spread * 2;
      context.stroke();
    }
    context.strokeStyle = rgba(
      stroke.color,
      stroke.opacity * (0.7 + 0.3 * density),
    );
    context.lineWidth = stroke.width * (0.8 + 0.2 * density);
    context.stroke();
  }

  // Unlabelled airport dots, busiest last so hubs sit on top. Never a code.
  let airports = 0;
  [...copy.map.airports].reverse().forEach((airport, index, all) => {
    const point = projectToFrame(frame, airport);
    if (!point) return;
    airports += 1;
    const kind = all.length - 1 - index < 5 ? "hub" : "base";
    const style = tokens.airport[kind];
    context.beginPath();
    context.fillStyle = rgba(tokens.color.airportHalo, 0.18);
    context.arc(point.x, point.y, style.halo, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = rgba(
      kind === "hub" ? tokens.color.airportHub : tokens.color.airport,
    );
    context.arc(point.x, point.y, style.radius, 0, Math.PI * 2);
    context.fill();
  });
  return { routes, airports };
}

function separator(
  context: Context2D,
  layout: NeonPassportLayout,
  tokens: MapThemeTokens,
) {
  context.save();
  context.beginPath();
  context.setLineDash([3, 9]);
  context.strokeStyle = rgba(tokens.color.dateline, 0.6);
  context.lineWidth = 1;
  context.moveTo(layout.content.x, layout.separator);
  context.lineTo(layout.content.x + layout.content.width, layout.separator);
  context.stroke();
  context.restore();
}

function statsTexture(
  context: Context2D,
  layout: NeonPassportLayout,
  tokens: MapThemeTokens,
) {
  const top = layout.fields[0]!.baseline + 26;
  const bottom = layout.mrz.area.y - 8;
  context.save();
  context.beginPath();
  context.rect(0, top, layout.width, bottom - top);
  context.clip();
  context.globalAlpha = 0.14;
  context.strokeStyle = rgba(tokens.color.routeGlow);
  context.lineWidth = 0.8;
  for (let index = 0; index * 34 < bottom - top + 34; index += 1) {
    const y = top + index * 34;
    context.beginPath();
    context.moveTo(30, y + Math.sin(index * 0.8) * 16);
    for (let x = 30; x <= layout.width - 30; x += 12)
      context.lineTo(x, y + Math.sin(x / 72 + index * 0.55) * 12);
    context.stroke();
  }
  context.restore();
}

/** Display type: the Latin brand face, then the regional sans for CJK. */
const display = (size: number): TextStyle => ({
  size,
  weight: 600,
  font: "display",
});

/**
 * A caption whose LAST line sits on `y`. Too wide at full size: wraps onto a
 * line above (at a space, or between graphemes for unspaced scripts); only a
 * label that still does not fit two lines shrinks, then shortens.
 */
function caption(
  painter: Painter,
  text: string,
  cell: { x: number; width: number },
  y: number,
  size: number,
  color: string,
) {
  const upper = text.toLocaleUpperCase();
  const style = { size, weight: 400 as const };
  const fits = (value: string) =>
    painter.measure(value, { ...style, letterSpacing: size * 0.06 }) <=
    cell.width;
  if (fits(upper))
    return label(painter, text, cell.x, y, cell.width, color, size);
  const words = upper.includes(" ") ? upper.split(" ") : shareGraphemes(upper);
  const joiner = upper.includes(" ") ? " " : "";
  let best = 1;
  let bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const widest = Math.max(
      painter.measure(words.slice(0, cut).join(joiner), style),
      painter.measure(words.slice(cut).join(joiner), style),
    );
    if (widest < bestWidth) {
      bestWidth = widest;
      best = cut;
    }
  }
  label(
    painter,
    words.slice(0, best).join(joiner),
    cell.x,
    y - Math.round(size * 1.2),
    cell.width,
    color,
    size,
  );
  return label(
    painter,
    words.slice(best).join(joiner),
    cell.x,
    y,
    cell.width,
    color,
    size,
  );
}

/** A display figure and its smaller unit, shrunk together to the cell. */
function figure(
  painter: Painter,
  stat: PosterStat,
  cell: NeonStatCell,
  size: number,
  unitSize: number,
  tokens: MapThemeTokens,
) {
  const gap = Math.round(size * 0.16);
  const unitStyle: TextStyle = { size: unitSize, weight: 400 };
  const unitWidth = stat.unit ? painter.measure(stat.unit, unitStyle) + gap : 0;
  let valueSize = size;
  while (
    valueSize > size * 0.45 &&
    painter.measure(stat.value, display(valueSize)) + unitWidth > cell.width
  )
    valueSize = Math.floor(valueSize * 0.96);
  const drawn = painter.text(stat.value, cell.x, cell.baseline, {
    ...display(valueSize),
    color: rgba(tokens.color.label),
    maxWidth: Math.max(40, cell.width - unitWidth),
  });
  if (stat.unit)
    painter.text(stat.unit, cell.x + drawn.width + gap, cell.baseline, {
      ...unitStyle,
      color: rgba(tokens.color.labelMuted),
      maxWidth: Math.max(30, cell.width - drawn.width - gap),
      minSize: 13,
    });
}

/** Keeps the saved name intact: shrink first, then two lines, then shorten. */
function holderName(
  painter: Painter,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  tokens: MapThemeTokens,
) {
  const { content, name } = layout;
  const value = copy.holder.name || "—";
  const color = rgba(tokens.color.label);
  if (painter.measure(value, display(name.minSize)) <= content.width) {
    painter.text(value, content.x, name.baseline, {
      ...display(name.size),
      color,
      maxWidth: content.width,
      minSize: name.minSize,
    });
    return;
  }
  const tokensOf = value.includes(" ")
    ? value.split(" ")
    : shareGraphemes(value);
  const joiner = value.includes(" ") ? " " : "";
  let cut = 1;
  for (let index = 1; index < tokensOf.length; index += 1)
    if (
      painter.measure(
        tokensOf.slice(0, index).join(joiner),
        display(name.minSize),
      ) <= content.width
    )
      cut = index;
  const lines = [
    tokensOf.slice(0, cut).join(joiner),
    tokensOf.slice(cut).join(joiner),
  ];
  lines.forEach((line, index) =>
    painter.text(
      line,
      content.x,
      name.baseline - name.lineHeight + index * name.lineHeight + 4,
      { ...display(name.minSize), color, maxWidth: content.width },
    ),
  );
}

function stamp(
  painter: Painter,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  tokens: MapThemeTokens,
) {
  const { context } = painter;
  const { x, y, width, height } = layout.stamp;
  const ink = rgba(tokens.color.airportHalo, 0.78);
  context.save();
  context.strokeStyle = ink;
  for (const [inset, weight] of [
    [0, 2],
    [6, 1],
  ] as const) {
    context.lineWidth = weight;
    context.beginPath();
    context.roundRect(
      x + inset,
      y + inset,
      width - inset * 2,
      height - inset * 2,
      14 - inset,
    );
    context.stroke();
  }
  context.restore();
  plane(context, x + 38, y + height / 2, 15, Math.PI / 2, ink);
  const textX = x + 68;
  const textWidth = width - 68 - 18;
  painter.text(copy.issuer, textX, y + height / 2 - 6, {
    size: 17,
    weight: 400,
    color: ink,
    maxWidth: textWidth,
    minSize: 11,
  });
  painter.text(copy.firstFlight, textX, y + height / 2 + 20, {
    size: 17,
    font: "mono",
    color: ink,
    maxWidth: textWidth,
    minSize: 11,
  });
}

function mrzBand(
  painter: Painter,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  tokens: MapThemeTokens,
) {
  const { area } = layout.mrz;
  painter.context.fillStyle = rgba(tokens.color.labelHalo, 0.72);
  painter.context.fillRect(area.x, area.y, area.width, area.height);
  drawMrzRows(painter, copy.mrz, {
    ...layout.mrz,
    color: rgba(tokens.color.label),
  });
}

export function drawNeonPassport(
  context: Context2D,
  layout: NeonPassportLayout,
  copy: PosterCopy,
  fonts: PosterFonts,
  theme: MapTheme,
): PosterDrawReport<NeonPassportLayout> {
  const { tokens } = theme;
  // Neon display type is the condensed brand face; scripts it lacks fall
  // through to the regional sans that the text role already resolved.
  const painter = new Painter(context, {
    ...fonts,
    families: {
      ...fonts.families,
      display: `${fonts.families.brand}, ${fonts.families.text}`,
    },
  });
  const pixelScale = Math.abs(context.getTransform().a) || 1;
  const muted = rgba(tokens.color.labelMuted);
  const ink = rgba(tokens.color.label);
  context.save();
  background(context, layout, tokens);
  aviationBand(painter, layout, copy, tokens);
  const map = worldMap(context, layout, copy, tokens, pixelScale);
  separator(context, layout, tokens);
  painter.text(
    copy.title.toLocaleUpperCase(),
    layout.content.x,
    layout.title.baseline,
    {
      ...display(layout.title.size),
      weight: 600,
      color: ink,
      maxWidth: layout.content.width,
      minSize: layout.title.minSize,
    },
  );
  caption(
    painter,
    copy.labels.name,
    layout.content,
    layout.name.label,
    layout.labelSize,
    muted,
  );
  holderName(painter, layout, copy, tokens);
  const fields: Array<[string, string]> = [
    [copy.labels.number, copy.holder.number],
    [copy.labels.firstFlight, copy.firstFlight],
    [copy.labels.period, copy.recordPeriod],
  ];
  fields.forEach(([name, value], index) => {
    const cell = layout.fields[index]!;
    caption(painter, name, cell, cell.label, layout.labelSize, muted);
    painter.text(value, cell.x, cell.baseline, {
      size: layout.fieldSize,
      font: "mono",
      color: ink,
      maxWidth: cell.width,
      minSize: 13,
    });
  });
  statsTexture(context, layout, tokens);
  const stats = [
    copy.distance,
    copy.flights,
    copy.duration,
    ...copy.secondary,
    copy.routes,
  ];
  stats.forEach((stat, index) => {
    const cell = layout.stats[index];
    if (!cell) return;
    caption(painter, stat.label, cell, cell.label, layout.labelSize, muted);
    figure(painter, stat, cell, layout.statSize, layout.unitSize, tokens);
  });
  stamp(painter, layout, copy, tokens);
  mrzBand(painter, layout, copy, tokens);
  context.restore();

  const inside = (box: PosterRect, rect: PosterRect) =>
    box.x >= rect.x - 0.5 &&
    box.y >= rect.y - 0.5 &&
    box.x + box.width <= rect.x + rect.width + 0.5 &&
    box.y + box.height <= rect.y + rect.height + 0.5;
  const within = (box: PosterTextBox, rect: PosterRect) =>
    inside(box, rect) && inside(box.ink, rect);
  return {
    texts: painter.texts,
    outside: painter.texts.filter((box) => !within(box, layout.safe)),
    paperOutside: painter.texts.filter((box) =>
      copy.mrz.includes(box.text)
        ? !inside(box.ink, layout.mrz.print)
        : !within(box, layout.content),
    ),
    truncated: painter.truncated,
    map,
    layout,
  };
}
