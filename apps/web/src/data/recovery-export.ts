export class UnsafeRecoveryCopyError extends Error {
  constructor() {
    super("A complete recovery copy cannot be safely represented as JSON.");
    this.name = "UnsafeRecoveryCopyError";
  }
}

/** Serialize the stored recovery source without validating or migrating it. */
export function serializeRecoveryCopy(rawDocument: unknown): string {
  assertJsonTree(rawDocument);
  try {
    return `${JSON.stringify(rawDocument, null, 2)}\n`;
  } catch {
    throw new UnsafeRecoveryCopyError();
  }
}

function assertJsonTree(rawDocument: unknown): void {
  const seen = new WeakSet<object>();
  const pending = [rawDocument];
  while (pending.length) {
    const value = pending.pop();
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      continue;
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      !Object.is(value, -0)
    )
      continue;
    if (typeof value !== "object") throw new UnsafeRecoveryCopyError();
    // Shared JSON values are written at each occurrence. The serializer
    // rejects cycles, which have no finite JSON representation.
    if (seen.has(value)) continue;
    seen.add(value);

    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== (array ? Array.prototype : Object.prototype))
      throw new UnsafeRecoveryCopyError();

    const keys = Reflect.ownKeys(value);
    // JSON arrays only keep their indexed elements and replace holes with null.
    if (array && keys.length !== value.length + 1)
      throw new UnsafeRecoveryCopyError();
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string") throw new UnsafeRecoveryCopyError();
      if (array) {
        const index = Number(key);
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        )
          throw new UnsafeRecoveryCopyError();
      }
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property?.enumerable || !("value" in property))
        throw new UnsafeRecoveryCopyError();
      pending.push(property.value);
    }
  }
}

export function downloadRecoveryCopy(rawDocument: unknown): void {
  const blob = new Blob([serializeRecoveryCopy(rawDocument)], {
    type: "application/json",
  });
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
