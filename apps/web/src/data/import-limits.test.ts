import { describe, expect, it } from "vitest";
import demo from "@keepraw-fly/core/demo";
import { parseKeeprawFlyJson } from "@keepraw-fly/validator";
import {
  assertRecordCount,
  ImportFileError,
  importFileProblem,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_RECORDS,
  readImportFile,
} from "./import-limits";

const sized = (size: number) => ({ size });

describe("import resource limits", () => {
  it("classifies empty, boundary and oversized files without reading them", () => {
    expect(importFileProblem(sized(0))).toBe("empty-file");
    expect(importFileProblem(sized(1))).toBeNull();
    expect(importFileProblem(sized(MAX_IMPORT_FILE_BYTES))).toBeNull();
    expect(importFileProblem(sized(MAX_IMPORT_FILE_BYTES + 1))).toBe(
      "file-too-large",
    );
  });

  it("never calls text() on an oversized file", async () => {
    let read = false;
    const file = {
      size: MAX_IMPORT_FILE_BYTES + 1,
      text: async () => {
        read = true;
        return "";
      },
    } as unknown as Blob;
    await expect(readImportFile(file)).rejects.toMatchObject({
      code: "file-too-large",
    });
    expect(read).toBe(false);
  });

  it("rejects whitespace-only files as empty", async () => {
    await expect(readImportFile(new Blob(["  \n\t"]))).rejects.toBeInstanceOf(
      ImportFileError,
    );
  });

  it("accepts a normal large archive (5,000 flights) well inside the limits", async () => {
    const flight = demo.flights[0]!;
    const archive = {
      ...demo,
      flights: Array.from({ length: 5_000 }, (_, index) => ({
        ...flight,
        id: `bulk-${index}`,
      })),
    };
    const text = JSON.stringify(archive, null, 2);
    expect(text.length).toBeLessThan(MAX_IMPORT_FILE_BYTES / 4);
    const read = await readImportFile(new Blob([text]));
    const result = parseKeeprawFlyJson(read);
    expect(result.valid).toBe(true);
    expect(() =>
      assertRecordCount(result.valid ? result.data.flights.length : 0),
    ).not.toThrow();
  });

  it("refuses record counts above the cap", () => {
    expect(() => assertRecordCount(MAX_IMPORT_RECORDS)).not.toThrow();
    expect(() => assertRecordCount(MAX_IMPORT_RECORDS + 1)).toThrow(
      ImportFileError,
    );
  });

  it("still reports structurally invalid but small files through validation", async () => {
    const text = await readImportFile(new Blob(['{"format":"nope"}']));
    expect(parseKeeprawFlyJson(text).valid).toBe(false);
  });
});
