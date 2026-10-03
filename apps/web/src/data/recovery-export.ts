/** Serialize the stored recovery source without validating or migrating it. */
export function serializeRecoveryCopy(rawDocument: unknown): string {
  const json = JSON.stringify(rawDocument, null, 2);
  if (json === undefined) {
    throw new Error("The stored archive cannot be represented as JSON.");
  }
  return `${json}\n`;
}

export function downloadRecoveryCopy(rawDocument: unknown): void {
  const blob = new Blob([serializeRecoveryCopy(rawDocument)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  try {
    link.href = url;
    link.download = `keepraw-fly-recovery-${new Date().toISOString().slice(0, 10)}.json`;
    window.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
