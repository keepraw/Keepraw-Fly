import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import keeprawFlySchema from "@keepraw-fly/schema/schema";
import demoDocument from "../../core/data/demo.keepraw-fly.json";
import precompiled from "../src/generated/schema-validator.js";
// @ts-expect-error The generator is a plain Node ESM module without types.
import { generateSchemaValidatorSource } from "../scripts/schema-validator-source.mjs";

const generatedPath = new URL(
  "../src/generated/schema-validator.js",
  import.meta.url,
);

function runtimeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(keeprawFlySchema);
}

describe("precompiled schema validator", () => {
  it("is regenerated from the current schema", () => {
    expect(readFileSync(generatedPath, "utf8")).toBe(
      (generateSchemaValidatorSource as () => string)(),
    );
  });

  it("contains no runtime code evaluation (CSP without unsafe-eval)", () => {
    const source = readFileSync(generatedPath, "utf8");
    expect(source).not.toMatch(/\bFunction\s*\(|\beval\s*\(|require\(/);
  });

  it("matches runtime Ajv results and errors for valid and invalid input", () => {
    const runtime = runtimeValidator();
    const inputs: unknown[] = [
      demoDocument,
      {},
      { ...demoDocument, flights: [{ id: "" }] },
      {
        ...demoDocument,
        flights: demoDocument.flights.map((flight, index) =>
          index === 0
            ? {
                ...flight,
                flightNumber: "😀😀😀😀😀😀😀😀😀😀😀😀😀",
                scheduledDeparture: "2026-13-40T99:00:00",
                unexpected: true,
              }
            : flight,
        ),
      },
    ];
    for (const input of inputs) {
      expect(precompiled(input)).toBe(runtime(input));
      expect(precompiled.errors ?? null).toEqual(runtime.errors ?? null);
    }
  });
});
