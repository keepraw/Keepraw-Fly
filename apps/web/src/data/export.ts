import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { redactSensitiveData } from "./redacted-export";

export type ExportKind = "backup" | "shareable";

/**
 * Builds the exported JSON text. "backup" is the complete, lossless archive;
 * "shareable" removes personal identifiers (see redacted-export.ts) and is
 * validated exactly like a backup so it remains importable.
 */
export async function serializeKeeprawFly(
  document: KeeprawFlyDocument,
  kind: ExportKind = "backup",
): Promise<string> {
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
  return `${JSON.stringify(validation.data, null, 2)}\n`;
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
