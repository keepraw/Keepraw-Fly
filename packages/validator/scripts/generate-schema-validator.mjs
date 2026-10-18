import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateSchemaValidatorSource } from "./schema-validator-source.mjs";

const target = fileURLToPath(
  new URL("../src/generated/schema-validator.js", import.meta.url),
);
writeFileSync(target, generateSchemaValidatorSource());
console.log(`Wrote ${target}`);
