import type { ErrorObject } from "ajv/dist/2020.js";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";

interface PrecompiledValidator {
  (data: unknown): data is KeeprawFlyDocument;
  errors?: ErrorObject[] | null;
}

declare const validate: PrecompiledValidator;
export default validate;
