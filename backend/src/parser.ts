// backend/src/parser.ts
import Ajv, { ErrorObject } from "ajv";
import schema from "../schemas/dbdoc.json";

export function parseDbdoc(parsedYaml: unknown): { ast: any | null; errors: any[] } {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);

  // Safely cast to Record<string, any> for AJV
  const data = parsedYaml as Record<string, any>;
  const valid = validate(data);

  if (!valid) {
    const errors = (validate.errors || []).map((e: ErrorObject) => ({
      message: e.message,
      // AJV v8 uses `instancePath` instead of deprecated `dataPath`
      path: e.instancePath,
      schemaPath: e.schemaPath,
    }));
    return { ast: null, errors };
  }

  const ast: any = {
    sources: data.sources || {},
    targets: data.targets || {},
    mappings: data.mappings || [],
    lineage: data.lineage || null,
    metadata: data.metadata || {},
  };

  return { ast, errors: [] };
}
