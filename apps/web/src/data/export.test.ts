import { describe, expect, it } from "vitest";
import type { JsonValue } from "@keepraw-fly/schema";
import { validateAndMigrateKeeprawFly } from "@keepraw-fly/validator";
import { scaleArchive } from "../../../../tests/fixtures/scale-archives";
import { serializeKeeprawFly } from "./export";
import { preflightJsonFileWork } from "./import-preview";
import { finishImportPreflight } from "./import-preflight-work";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_RECORDS } from "./import-limits";

describe("full backup restore limits", () => {
  it("refuses the 35,578,237-byte audit archive at 100,001 valid flights", async () => {
    const archive = scaleArchive(MAX_IMPORT_RECORDS + 1);
    for (const [index, flight] of archive.flights.entries()) {
      flight.id = index.toString(36);
      flight.flightNumber = "UA1";
      flight.airline = { iata: "UA" };
      flight.scheduledDeparture = "2025-03-01T10:00:00Z";
      flight.scheduledArrival = "2025-03-01T11:30:00Z";
    }
    const byteCount = 35_578_237;
    archive.extensions = { "example.audit": "" };
    const bytesBeforePadding = new Blob([
      JSON.stringify(archive, null, 2),
      "\n",
    ]).size;
    archive.extensions["example.audit"] = "a".repeat(
      byteCount - bytesBeforePadding,
    );
    const auditJson = `${JSON.stringify(archive, null, 2)}\n`;
    expect(new Blob([auditJson]).size).toBe(byteCount);
    // The same record limit applies before export and before import validation.
    await expect(serializeKeeprawFly(archive)).rejects.toMatchObject({
      code: "too-many-records",
    });
    expect(() =>
      finishImportPreflight(
        preflightJsonFileWork(auditJson, null, validateAndMigrateKeeprawFly),
      ),
    ).toThrow("too-many-records");
  });

  it("refuses compact backups whose UTF-8 bytes exceed the upload limit", async () => {
    const archive = scaleArchive(0);
    archive.extensions = {
      "example.multibyte": "旅".repeat(Math.ceil(MAX_IMPORT_FILE_BYTES / 3)),
    };
    expect(JSON.stringify(archive).length).toBeLessThan(MAX_IMPORT_FILE_BYTES);
    await expect(serializeKeeprawFly(archive)).rejects.toMatchObject({
      code: "file-too-large",
    });
  });

  it("refuses a full backup that would lose structured-clone extension values", async () => {
    const archive = scaleArchive(1);
    const extension = new Map([["trip", "preserve"]]);
    archive.extensions = {
      "example.legacy": extension as unknown as JsonValue,
    };
    await expect(serializeKeeprawFly(archive)).rejects.toThrow(
      "cannot preserve all values",
    );
    expect(extension.get("trip")).toBe("preserve");
  });
});
