// ============================================
// backend/src/core/validator.ts
// ============================================
import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../schema/dbdoc.schema.json";
import { validateSchema as validateSemantic } from "./schemaValidator.js";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validateDbDoc(doc: any) {
  const validate = ajv.compile(schema);
  const structuralValid = validate(doc);
  const structuralErrors = validate.errors || [];

  const semantic = validateSemantic(doc);

  const allErrors = [
    ...structuralErrors.map(
      (e: any) => `${e.instancePath || e.schemaPath} ${e.message}`
    ),
    ...(semantic.errors || []),
  ];

  const allWarnings = semantic.warnings || [];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
