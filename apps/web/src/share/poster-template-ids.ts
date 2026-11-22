/** Registered Flight Passport layouts. Kept free of drawing code so storage
 * and Settings can validate a stored id without loading a renderer. */
export const POSTER_TEMPLATE_IDS = ["neon", "book"] as const;

export type PosterTemplateId = (typeof POSTER_TEMPLATE_IDS)[number];

export const DEFAULT_POSTER_TEMPLATE_ID: PosterTemplateId = "neon";

export function isPosterTemplateId(value: unknown): value is PosterTemplateId {
  return (
    typeof value === "string" &&
    (POSTER_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}
