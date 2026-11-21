import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { KEEPRAW_FLY_FORMAT_VERSION } from "@keepraw-fly/schema";
import {
  assertRecordCount,
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
} from "./import-limits";
import { redactSensitiveData } from "./redacted-export";

export type ExportKind = "backup" | "shareable";

/**
 * Builds the exported JSON text. Complete backups must fit the restore limits.
 * Shareable exports remove personal identifiers (see redacted-export.ts).
 */
export async function serializeKeeprawFly(
  document: KeeprawFlyDocument,
  kind: ExportKind = "backup",
): Promise<string> {
  if (kind === "backup") assertRecordCount(document.flights.length);
  const { validateAndMigrateKeeprawFly } =
    await import("@keepraw-fly/validator");
  const source =
    kind === "shareable" ? redactSensitiveData(document).document : document;
  const validation = validateAndMigrateKeeprawFly(source);
  if (!validation.valid) {
    throw new Error(
      kind === "shareable"
        ? "The shareable archive failed validation and cannot be exported."
        : "The current archive failed validation and cannot be exported.",
    );
  }
  const hasIdentity = validation.data.flights.some((flight) =>
    [flight.origin, flight.destination, flight.divertedTo].some(
      (endpoint) => endpoint?.airportId,
    ),
  );
  const archive = {
    ...validation.data,
    formatVersion: hasIdentity
      ? KEEPRAW_FLY_FORMAT_VERSION
      : validation.data.formatVersion,
  };
  if (kind === "shareable") return `${JSON.stringify(archive, null, 2)}\n`;

  // Abort obviously oversized serialization before it can build a large string.
  // The lower bound excludes UTF-8 expansion, boundaries and escaping.
  let minimumBytes = 1;
  const compact = `${JSON.stringify(
    archive,
    function (this: Record<string, unknown>, key, value: unknown) {
      const parentIsArray = Array.isArray(this);
      const storedValue = this[key];
      const losesFields =
        value !== storedValue ||
        (typeof value === "number" && !Number.isFinite(value)) ||
        (parentIsArray && value === undefined) ||
        (value !== null &&
          typeof value === "object" &&
          (Array.isArray(value)
            ? Object.keys(value).length !== value.length
            : Object.getPrototypeOf(value) !== Object.prototype));
      if (losesFields)
        throw new Error(
          "A full JSON backup cannot preserve all values in the archive.",
        );
      if (!parentIsArray) {
        if (value === undefined) return value;
        minimumBytes += key.length;
      }
      minimumBytes += typeof value === "string" ? value.length + 2 : 1;
      if (minimumBytes > MAX_IMPORT_FILE_BYTES)
        throw new ImportFileError("file-too-large");
      return value;
    },
  )}\n`;
  if (new Blob([compact]).size > MAX_IMPORT_FILE_BYTES)
    throw new ImportFileError("file-too-large");

  // Keep normal backups readable and avoid expanding large documents with
  // indentation. Test the exact UTF-8 bytes, including the trailing newline.
  if (compact.length > 1024 * 1024) return compact;
  const formatted = `${JSON.stringify(archive, null, 2)}\n`;
  return new Blob([formatted]).size <= MAX_IMPORT_FILE_BYTES
    ? formatted
    : compact;
}

export async function downloadKeeprawFly(
  document: KeeprawFlyDocument,
  kind: ExportKind = "backup",
): Promise<void> {
  const text = await serializeKeeprawFly(document, kind);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download =
    kind === "shareable"
      ? `keepraw-fly-shareable-${date}.json`
      : `keepraw-fly-${date}.json`;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
