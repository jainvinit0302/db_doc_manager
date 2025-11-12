// backend/src/core/validator.ts
import schema from "../schema/dbdoc.schema.json" with { type: "json" };
import { validateSchema as validateSemantic } from "./schemaValidator.js";
import AjvPkg from "ajv";
import addFormatsPkg from "ajv-formats";

const Ajv = (AjvPkg as any).default || AjvPkg;
const addFormats = (addFormatsPkg as any).default || addFormatsPkg;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validateDbDoc(doc: any) {
  const validate = ajv.compile(schema as any);
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

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}

export function validateDbDocOrThrow(doc: any) {
  const { valid, errors, warnings } = validateDbDoc(doc);
  if (!valid) {
    const msg = errors.join("\n");
    const err = new Error("DBDoc Validation Failed:\n" + msg);
    (err as any).warnings = warnings;
    throw err;
  }
  return { valid, warnings };
}
