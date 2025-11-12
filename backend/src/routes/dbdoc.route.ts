// ============================================
// backend/src/routes/dbdoc.route.ts
// ============================================
import { Router } from "express";
import yaml from "js-yaml";
import { validateDbDoc } from "../core/validator.js";
import { normalizeDbDoc } from "../core/normalizer.js";

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

    // Step 1: Parse YAML
    let parsed;
    try {
      parsed = yaml.load(raw) as any;
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        errors: [`YAML parsing error: ${err.message}`],
      });
    }

    // Step 2: Validation (Ajv + semantic)
    const { valid, errors, warnings } = validateDbDoc(parsed);
    if (!valid) {
      return res.status(400).json({ success: false, errors, warnings });
    }

    // Step 3: Normalize structure
    const normalized = normalizeDbDoc(parsed);

    // Step 4: Generate outputs
    const erd = generateERD(normalized);
    const lineage = generateLineage(normalized);
    const sql = generateSQL(normalized);
    const documentation = generateDocumentation(normalized);

    return res.json({
      success: true,
      data: {
        project: normalized.project,
        owners: normalized.owners,
        targets: normalized.targets,
        sources: normalized.sources,
        mappings: normalized.mappings,
        erd,
        lineage,
        sql,
        documentation,
      },
      warnings,
    });
  } catch (err: any) {
    console.error("Process error:", err);
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// ============================================
// Generator Functions
// ============================================

function generateERD(normalized: any): string {
  let mermaid = "erDiagram\n";

  if (!normalized.targets || normalized.targets.length === 0) {
    return mermaid + "  %% No targets defined\n";
  }

  normalized.targets.forEach((target: any) => {
    if (!target.tables) return;

    target.tables.forEach((table: any) => {
      const tableName = `${target.schema}_${table.name}`;
      mermaid += `  ${tableName} {\n`;

      if (table.columns) {
        table.columns.forEach((col: any) => {
          const attrs = [];
          if (col.pk) attrs.push("PK");
          if (col.unique) attrs.push("UK");
          if (col.not_null) attrs.push("NN");

          mermaid += `    ${col.type} ${col.name} "${attrs.join(",") || ""}"\n`;
        });
      }

      mermaid += "  }\n";
    });
  });

  return mermaid;
}

function generateLineage(normalized: any): any[] {
  const lineage: any[] = [];

  if (!normalized.mappings) return lineage;

  const sources = new Map();
  if (normalized.sources) {
    normalized.sources.forEach((source: any) => {
      sources.set(source.id, {
        id: source.id,
        kind: source.kind,
        location:
          source.kind === "mongodb"
            ? `${source.db}.${source.collection}`
            : source.db || "unknown",
      });
    });
  }

  normalized.mappings.forEach((mapping: any, idx: number) => {
    const item: any = {
      id: `lineage_${idx}`,
      target: mapping.target,
      source: null,
      transform: mapping.transform || null,
    };

    if (mapping.source_id) {
      const sourceInfo = sources.get(mapping.source_id);
      if (sourceInfo) {
        item.source = sourceInfo.location;
        if (mapping.source_path) {
          item.source += mapping.source_path;
        }
      } else {
        item.source = `[unknown:${mapping.source_id}]`;
      }
    } else if (mapping.rule) {
      item.source = `[generated:${mapping.rule}]`;
    }

    lineage.push(item);
  });

  return lineage;
}

function generateSQL(normalized: any): string {
  let sql = `-- DBDocManager Generated SQL\n`;
  sql += `-- Project: ${normalized.project}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;

  if (!normalized.targets) return sql + "-- No targets\n";

  normalized.targets.forEach((target: any) => {
    sql += `-- Database: ${target.db}, Schema: ${target.schema}, Engine: ${target.engine}\n\n`;

    if (target.tables) {
      target.tables.forEach((table: any) => {
        sql += `CREATE TABLE ${target.schema}.${table.name} (\n`;
        const cols: string[] = [];
        const pks: string[] = [];

        table.columns?.forEach((col: any) => {
          let def = `  ${col.name} ${col.type}`;
          if (col.not_null) def += " NOT NULL";
          if (col.default) def += ` DEFAULT ${col.default}`;
          cols.push(def);
          if (col.pk) pks.push(col.name);
        });

        sql += cols.join(",\n");
        if (pks.length > 0) {
          sql += `,\n  PRIMARY KEY (${pks.join(", ")})`;
        }
        sql += "\n);\n\n";
      });
    }
  });

  return sql;
}

function generateDocumentation(normalized: any): any {
  return {
    project: normalized.project,
    generated: new Date().toISOString(),
    summary: {
      totalTargets: normalized.targets?.length || 0,
      totalTables: normalized.targets?.reduce(
        (sum: number, t: any) => sum + (t.tables?.length || 0),
        0
      ) || 0,
      totalMappings: normalized.mappings?.length || 0,
    },
  };
}