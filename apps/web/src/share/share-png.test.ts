import { describe, expect, it } from "vitest";
import { listPngChunks, readPngHeader } from "./share-png";

describe("PNG header", () => {
  it("parses the signature, IHDR size and chunk list", () => {
    // 1×1 RGBA PNG.
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      ),
      (c) => c.charCodeAt(0),
    );
    expect(readPngHeader(bytes)).toMatchObject({ width: 1, height: 1 });
    expect(listPngChunks(bytes)).toEqual(["IHDR", "IDAT", "IEND"]);
    const broken = bytes.slice();
    broken[1] = 0;
    expect(readPngHeader(broken)).toBeNull();
  });
});
