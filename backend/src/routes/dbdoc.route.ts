// backend/src/routes/dbdoc.route.ts
import { Router } from "express";
import yaml from "js-yaml";
import { validateDbDoc } from "../core/validator.js";
import { normalizeDbDoc } from "../core/normalizer.js";
import { 
  generatePostgresSQL, 
  generateMySQLSQL, 
  generateMongoSchema 
} from "../generators/sqlGenerator.js";
import { generateERD } from "../generators/erdGenerator.js";
import { generateLineage } from "../generators/lineageGenerator.js";
import { generateDocumentation } from "../generators/docGenerator.js";

export const router = Router();

router.post("/process", async (req, res) => {
  try {
    const raw = typeof req.body === "string" ? req.body : req.body.yaml;

    if (!raw) {
      return res.status(400).json({
        success: false,
        errors: ["Missing YAML input"],
      });
    }

    // Parse YAML
    let parsed: any;
    try {
      parsed = yaml.load(raw);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        errors: [`YAML parsing error: ${err.message}`],
      });
    }

    // Validate
    const { valid, errors, warnings } = validateDbDoc(parsed);
    if (!valid) {
      return res.status(400).json({ 
        success: false, 
        errors, 
        warnings 
      });
    }

    // Normalize
    const normalized = normalizeDbDoc(parsed);

    // Generate all outputs
    const postgresSQL = generatePostgresSQL(normalized);
    const mysqlSQL = generateMySQLSQL(normalized);
    const mongoSchema = generateMongoSchema(normalized);
    const erd = generateERD(normalized);
    const lineage = generateLineage(normalized);
    const documentation = generateDocumentation(normalized);

    return res.json({
      success: true,
      data: {
        project: normalized.project,
        owners: normalized.owners,
        targets: normalized.targets,
        sources: normalized.sources,
        mappings: normalized.mappings,
        
        // SQL outputs
        sql: {
          postgres: postgresSQL,
          mysql: mysqlSQL,
          mongodb: mongoSchema,
        },
        
        // Visualizations
        erd: erd,
        lineage: lineage,
        
        // Documentation
        documentation: documentation,
      },
      warnings,
    });
  } catch (err: any) {
    console.error("Process error:", err);
    res.status(500).json({ 
      success: false, 
      errors: [err.message] 
    });
  }
});