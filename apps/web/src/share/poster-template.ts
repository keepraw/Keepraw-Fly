import type { MapTheme } from "../map2d/theme";
import type { PosterCopy } from "./poster-copy";
import type { PosterFonts } from "./poster-fonts";
import {
  createPosterLayout,
  type PosterLayout,
  type PosterRect,
} from "./poster-layout";
import {
  createNeonPassportLayout,
  drawNeonPassport,
  type NeonPassportLayout,
} from "./poster-neon";
import type { Context2D, PosterDrawReport } from "./poster-paint";
import { drawPoster } from "./poster-render";
import {
  DEFAULT_POSTER_TEMPLATE_ID,
  isPosterTemplateId,
  type PosterTemplateId,
} from "./poster-template-ids";

/** What every layout template exposes to the exporter and the viewer. */
export interface PosterArtboard {
  width: number;
  height: number;
  safe: PosterRect;
}

/**
 * A Flight Passport layout template. A template owns composition only: where
 * the map, statistics, holder fields and MRZ go. Map colours and strokes come
 * from the active map theme, and the numbers from `PosterCopy`, so a new
 * layout or a new theme can be added without touching the other.
 */
export interface PosterTemplate<
  Layout extends PosterArtboard = PosterArtboard,
> {
  id: string;
  /** Device pixels per artboard unit in the exported PNG. */
  pixelRatio: number;
  /** False when the template keeps its own palette (the paper book). */
  followsMapTheme: boolean;
  createLayout(): Layout;
  draw(
    context: Context2D,
    layout: Layout,
    copy: PosterCopy,
    fonts: PosterFonts,
    theme: MapTheme,
  ): PosterDrawReport<Layout>;
}

const NEON_TEMPLATE: PosterTemplate<NeonPassportLayout> = {
  id: "neon",
  pixelRatio: 2,
  followsMapTheme: true,
  createLayout: createNeonPassportLayout,
  draw: drawNeonPassport,
};

const BOOK_TEMPLATE: PosterTemplate<PosterLayout> = {
  id: "book",
  pixelRatio: 1,
  followsMapTheme: false,
  createLayout: createPosterLayout,
  draw: (context, layout, copy, fonts) =>
    drawPoster(context, layout, copy, fonts),
};

// Each template only ever receives the layout it created itself.
export const POSTER_TEMPLATES: Record<PosterTemplateId, PosterTemplate> = {
  neon: NEON_TEMPLATE as unknown as PosterTemplate,
  book: BOOK_TEMPLATE as unknown as PosterTemplate,
};

/** Unknown or stale stored ids fall back to the default template. */
export function resolvePosterTemplate(id: unknown): PosterTemplate {
  return POSTER_TEMPLATES[
    isPosterTemplateId(id) ? id : DEFAULT_POSTER_TEMPLATE_ID
  ];
}
