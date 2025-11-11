// src/routes/validate.ts
import { Router, Request, Response } from "express";
import cors from "cors";
import YAML from "js-yaml";
import { DBDocValidator } from "../validator/validator";
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../types/ast";

const router = Router();
router.use(cors()); // dev-only; configure properly in prod

function mkResult(
  valid: boolean,
  errors: ValidationError[] = [],
  warnings: ValidationWarning[] = []
): ValidationResult {
  return { valid, errors, warnings };
}

function mkErr(type: string, message: string, location?: string | null): ValidationError {
  return { type, message, location: location ?? undefined };
}

/**
 * Type guard to detect Promise-like results.
 * Note: uses `value is Promise<T>` predicate so TypeScript narrows the type.
 */
function isPromise<T = any>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as any).then === "function"
  );
}

router.post("/validate", async (req: Request, res: Response) => {
  const { dsl } = req.body ?? {};

  if (typeof dsl !== "string") {
    return res
      .status(400)
      .json(mkResult(false, [mkErr("INVALID_INPUT", "`dsl` string required in body")]));
  }

  // Parse DSL: try JSON first, then YAML as a fallback
  let ast: unknown;
  try {
    try {
      ast = JSON.parse(dsl);
    } catch {
      ast = YAML.load(dsl);
    }
  } catch (parseErr: any) {
    console.error("Parse error:", parseErr);
    return res
      .status(400)
      .json(mkResult(false, [mkErr("PARSE_ERROR", String(parseErr?.message ?? parseErr))]));
  }

  try {
    ast = normalizeAst(ast);

    const validator = new DBDocValidator();

    // validator.validate(...) may return ValidationResult OR Promise<ValidationResult>
    const maybe = validator.validate(ast as any);

    let result: ValidationResult;
    if (isPromise<ValidationResult>(maybe)) {
      // TS now knows `maybe` is a Promise<ValidationResult>
      result = await maybe;
    } else {
      result = maybe;
    }

    // Basic sanity-check: shape must include `valid`
    if (!result || typeof result !== "object" || !("valid" in result)) {
      return res
        .status(500)
        .json(mkResult(false, [mkErr("VALIDATOR_ERROR", "Validator returned unexpected result")]));
    }

    return res.json(result);
  } catch (err: any) {
    console.error("Validator runtime error:", err);
    const message = err?.message ?? String(err ?? "Unknown validator error");
    return res.status(500).json(mkResult(false, [mkErr("VALIDATION_EXCEPTION", message)]));
  }
});

// simple normalizer — add defaults for optional arrays/objects
function normalizeAst(ast: any): any {
  if (!ast || typeof ast !== 'object') return ast;

  // basic top-level defaults per your ast.ts
  if (typeof ast.project !== 'string') ast.project = ast.project ?? 'unnamed';
  if (!Array.isArray(ast.targets)) ast.targets = [];
  if (!Array.isArray(ast.sources)) ast.sources = [];
  if (!Array.isArray(ast.mappings)) ast.mappings = [];

  // also ensure each target has a tables array
  for (const t of ast.targets) {
    if (t && typeof t === 'object') {
      if (!Array.isArray(t.tables)) t.tables = [];
    }
  }

  return ast;
}


export default router;
