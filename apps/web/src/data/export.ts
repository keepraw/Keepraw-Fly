import type { KeeprawFlyDocument } from "@keepraw-fly/schema";

export async function downloadKeeprawFly(document: KeeprawFlyDocument): Promise<void> {
  const { validateKeeprawFly } = await import("@keepraw-fly/validator");
  const validation = validateKeeprawFly(document);
  if (!validation.valid) {
    throw new Error("The current archive failed validation and cannot be exported.");
  }

  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `keepraw-fly-${new Date().toISOString().slice(0, 10)}.json`;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
