import Ajv from "ajv";
import schema from "../schema/dbdoc.schema.json" with { type: "json" };

const ajv = new Ajv.default({ allErrors: true });

export function validateDbDoc(doc: any) {
  const validate = ajv.compile(schema as any);
  const valid = validate(doc);
  if (!valid) {
    const errors = validate.errors?.map(
      e => `${e.instancePath || e.schemaPath} ${e.message}`
    );
    throw new Error("Validation failed:\n" + errors?.join("\n"));
  }
  return true;
}
