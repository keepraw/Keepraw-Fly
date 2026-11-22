import type { MapTheme } from "../map2d/theme";
import type { PosterCopy } from "./poster-copy";
import type { PosterDrawReport } from "./poster-paint";
import { resolveMapTheme } from "../map2d/theme-registry";
import {
  resolvePosterTemplate,
  type PosterArtboard,
  type PosterTemplate,
} from "./poster-template";
import { readPngHeader } from "./share-png";
import type { PosterFonts } from "./poster-fonts";

/**
 * Canvas 2D poster export: fixed-size canvas → `image/png` Blob, verified by
 * signature and IHDR before it is handed out. Runs entirely in the browser;
 * no WebGL, no DOM capture, no upload.
 */
export type PosterExportErrorKind =
  "canvas-unavailable" | "encoding" | "invalid-png" | "layout-overflow";

export class PosterExportError extends Error {
  readonly kind: PosterExportErrorKind;
  constructor(kind: PosterExportErrorKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PosterExportError";
    this.kind = kind;
  }
}

export interface PosterRenderInput {
  /** Composition; independent of the map theme that colours it. */
  template: PosterTemplate;
  /** Created by `template.createLayout()`. */
  layout: PosterArtboard;
  copy: PosterCopy;
  fonts: PosterFonts;
  theme: MapTheme;
}

/** Complete input for a stored template id and map theme id; unknown ids
 * resolve to the defaults. */
export function posterRenderInput(
  templateId: unknown,
  mapThemeId: unknown,
  copy: PosterCopy,
  fonts: PosterFonts,
): PosterRenderInput {
  const template = resolvePosterTemplate(templateId);
  return {
    template,
    layout: template.createLayout(),
    copy,
    fonts,
    theme: resolveMapTheme(mapThemeId),
  };
}

/** Exported pixel size: the artboard at the template's pixel ratio. */
export function posterPixelSize(input: {
  template: Pick<PosterTemplate, "pixelRatio">;
  layout: Pick<PosterArtboard, "width" | "height">;
}) {
  return {
    width: Math.round(input.layout.width * input.template.pixelRatio),
    height: Math.round(input.layout.height * input.template.pixelRatio),
  };
}

/** Draws into an existing canvas at `pixelWidth`. */
export function renderPosterToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  input: PosterRenderInput,
  pixelWidth: number,
): PosterDrawReport<PosterArtboard> {
  const scale = pixelWidth / input.layout.width;
  const width = Math.round(input.layout.width * scale);
  const height = Math.round(input.layout.height * scale);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false }) as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context)
    throw new PosterExportError(
      "canvas-unavailable",
      "Canvas 2D is unavailable",
    );
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingEnabled = true;
  const report = input.template.draw(
    context,
    input.layout,
    input.copy,
    input.fonts,
    input.theme,
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
  return report;
}

export interface PosterExportResult {
  blob: Blob;
  width: number;
  height: number;
  report: PosterDrawReport<PosterArtboard>;
}

export interface PosterExportOptions {
  document?: Document;
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else
          reject(
            new PosterExportError("encoding", "The PNG could not be encoded"),
          );
      }, "image/png");
    } catch (cause) {
      reject(
        new PosterExportError(
          "encoding",
          "The PNG could not be encoded",
          cause,
        ),
      );
    }
  });
}

/** Full-resolution export: the artboard at the template's pixel ratio. */
export async function exportPosterPng(
  input: PosterRenderInput,
  options: PosterExportOptions = {},
): Promise<PosterExportResult> {
  const owner = options.document ?? document;
  const canvas = owner.createElement("canvas");
  const size = posterPixelSize(input);
  try {
    const report = renderPosterToCanvas(canvas, input, size.width);
    if (report.outside.length || report.paperOutside.length)
      throw new PosterExportError(
        "layout-overflow",
        `Poster text left its print area: ${report.outside.length + report.paperOutside.length} item(s)`,
      );
    const blob = await encode(canvas);
    const header = readPngHeader(new Uint8Array(await blob.arrayBuffer()));
    if (
      blob.type !== "image/png" ||
      !header ||
      header.width !== size.width ||
      header.height !== size.height
    )
      throw new PosterExportError(
        "invalid-png",
        "The encoded PNG does not match the artboard",
      );
    return {
      blob,
      width: header.width,
      height: header.height,
      report,
    };
  } finally {
    // Release the backing store right away; it can be ~8 MB per export.
    canvas.width = 0;
    canvas.height = 0;
  }
}
