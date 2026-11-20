import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import published from "../data/airport-history/formal/airports.json";
import manifest from "../data/airport-history/formal/manifest.json";
import reviewedTransfers from "../data/airport-history/reviewed-transfers.json";
import {
  formalAssignments,
  formalHistoricalNames,
} from "../src/formal-airport-data";

async function loadPublication(dataset: unknown) {
  vi.resetModules();
  vi.doMock("../data/airport-history/formal/airports.json", () => ({
    default: dataset,
  }));
  return import("../src/formal-airport-data");
}

afterEach(() => {
  vi.doUnmock("../data/airport-history/formal/airports.json");
  vi.resetModules();
});

it("bundles the exact pinned Schema 4.0.0 publication", () => {
  expect(published.schemaVersion).toBe("4.0.0");
  expect(manifest).toMatchObject({
    schemaVersion: published.schemaVersion,
    dataVersion: published.dataVersion,
  });
  const bytes = readFileSync(
    new URL("../data/airport-history/formal/airports.json", import.meta.url),
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    manifest.files["data/airports.json"].sha256,
  );
});

it("preserves published assignment and official-name records outside reviewed transfers", () => {
  const reviewedIds = new Set(
    reviewedTransfers.transfers.flatMap(({ supersedes }) => supersedes),
  );
  const unchanged = published.assignments.filter(
    ({ assignmentId }) => !reviewedIds.has(assignmentId),
  );
  const assignments = new Map(
    formalAssignments.map((row) => [row.assignmentId, row]),
  );
  expect(assignments.size).toBe(formalAssignments.length);
  expect(
    unchanged.map(({ assignmentId }) => assignments.get(assignmentId)),
  ).toEqual(unchanged);
  expect(formalHistoricalNames).toEqual(published.names);
});

it("uses revised upstream intervals when a reviewed assignment ID is reused", async () => {
  const transfer = reviewedTransfers.transfers[0]!;
  const updated = {
    assignmentId: transfer.supersedes[0]!,
    airportId: transfer.publishedAirportId,
    scheme: "IATA",
    code: "PQM",
    validFrom: transfer.handover,
    validTo: reviewedTransfers.originalInterval.validTo,
  };
  const runtime = await loadPublication({
    ...published,
    assignments: [updated],
  });
  expect(runtime.formalAssignments).toEqual([updated]);
});

it.each(["3.0.0", "5.0.0"])(
  "rejects unsupported formal schema %s",
  async (schemaVersion) => {
    await expect(
      loadPublication({ ...published, schemaVersion }),
    ).rejects.toThrow(`Unsupported Airport History schema: ${schemaVersion}`);
  },
);
