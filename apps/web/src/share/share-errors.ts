/** Every failure of the share rendering pipeline maps to exactly one kind. */
export type ShareRenderErrorKind =
  | "webgl2-unavailable"
  | "webgl-initialization"
  | "texture"
  | "shader"
  | "context-lost"
  | "readback"
  | "encoding"
  | "invalid-plan"
  | "disposed";

export class ShareRenderError extends Error {
  readonly kind: ShareRenderErrorKind;
  readonly resource?: string;
  constructor(
    kind: ShareRenderErrorKind,
    message: string,
    options: { cause?: unknown; resource?: string } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ShareRenderError";
    this.kind = kind;
    this.resource = options.resource;
  }
}

export const isShareRenderError = (value: unknown): value is ShareRenderError =>
  value instanceof ShareRenderError;
