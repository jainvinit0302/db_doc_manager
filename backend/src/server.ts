// backend/src/server.ts
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import YAML from "js-yaml";
import cors from "cors";

import { validateStructure, normalize } from "./parser";
import { writeMappingCSV, generateMermaidERD, generateLineageJSON } from "./generator";
import { referentialValidate } from "./validator";

const app = express();
app.use(cors({ origin: "*" }));
app.use(
  express.text({
    type: ["text/*", "application/x-yaml", "application/yaml"],
    limit: "2mb",
  })
);
app.use(express.json({ limit: "2mb" }));

function makeTempDir(prefix = "dbdoc-") {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return base;
}

// /api/validate : parse YAML, run JSON-schema (AJV) + referential validation
app.post("/api/validate", (req, res) => {
  try {
    const yamlText =
      typeof req.body === "string"
        ? req.body
        : req.body && (req.body as any).yaml
        ? (req.body as any).yaml
        : null;

    if (!yamlText) {
      return res
        .status(400)
        .json({ error: "Empty request body. Send YAML text in the POST body." });
    }

    let parsed: any;
    try {
      parsed = YAML.load(yamlText);
    } catch (e: any) {
      return res
        .status(400)
        .json({ error: "YAML parse error", detail: String(e.message || e) });
    }

    // AJV schema validation (structure)
    const ajvResult = validateStructure(parsed);
    const ajvValid = ajvResult.valid;
    const ajvErrors = ajvResult.errors || [];

    // normalize into AST shape expected by referential validator and generator
    const aggregated = {
      targets: parsed.targets || [],
      sources: parsed.sources || [],
      mappings: parsed.mappings || [],
    };
    const ast = normalize(aggregated);

    const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

    const valid = ajvValid && (!refErrors || refErrors.length === 0);

    return res.json({
      valid,
      ajvErrors,
      referentialErrors: refErrors,
      referentialWarnings: refWarnings,
    });
  } catch (err: any) {
    console.error("Validation endpoint error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// /api/generate : authoritative generate — CSV, mermaid .mmd, lineage JSON
app.post("/api/generate", (req, res) => {
  try {
    const yamlText =
      typeof req.body === "string"
        ? req.body
        : req.body && (req.body as any).yaml
        ? (req.body as any).yaml
        : null;

    if (!yamlText) {
      return res
        .status(400)
        .json({ error: "Empty request body. Send YAML text in the POST body." });
    }

    let parsed: any;
    try {
      parsed = YAML.load(yamlText);
    } catch (e: any) {
      return res
        .status(400)
        .json({ error: "YAML parse error", detail: String(e.message || e) });
    }

    // AJV schema validation (structure)
    const ajvResult = validateStructure(parsed);
    const ajvValid = ajvResult.valid;
    const ajvErrors = ajvResult.errors || [];

    // normalize AST for referential validation and generation
    const aggregated = {
      targets: parsed.targets || [],
      sources: parsed.sources || [],
      mappings: parsed.mappings || [],
    };
    const ast = normalize(aggregated);

    const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

    // fail fast if structural or referential validation failed
    if (!ajvValid || (refErrors && refErrors.length > 0)) {
      return res.status(400).json({
        error: "Validation failed",
        ajvErrors,
        referentialErrors: refErrors,
        referentialWarnings: refWarnings,
      });
    }

    // Prepare temporary dirs for artifacts
    const tmpDir = makeTempDir("dbdoc-");
    const artifactsDir = path.join(tmpDir, "artifacts");
    const erdDir = path.join(tmpDir, "erd");
    const lineageOut = path.join(tmpDir, "lineage");
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.mkdirSync(erdDir, { recursive: true });
    fs.mkdirSync(lineageOut, { recursive: true });

    // Generate artifacts
    writeMappingCSV(ast, artifactsDir);
    generateMermaidERD(ast, erdDir);

    // Read CSV
    const csvPath = path.join(artifactsDir, "mapping_matrix.csv");
    const csv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, "utf8") : "";

    // Read mermaid files
    const mermaidFiles: Array<{ name: string; content: string }> = [];
    if (fs.existsSync(erdDir)) {
      for (const fname of fs.readdirSync(erdDir)) {
        const content = fs.readFileSync(path.join(erdDir, fname), "utf8");
        mermaidFiles.push({ name: fname, content });
      }
    }

    // Generate lineage JSON (and write lineage.json into lineageOut)
    let lineage: any = null;
    try {
      lineage = generateLineageJSON(ast, lineageOut);
      // lineage is returned by the generator (object), and a file lineage.json is also written
    } catch (errLine: any) {
      console.error("Lineage generation error:", errLine);
      lineage = null;
    }

    // Respond with all artifacts
    return res.json({
      csv,
      mermaids: mermaidFiles,
      lineage,
      referentialWarnings: refWarnings,
    });
  } catch (err: any) {
    console.error("Generate endpoint error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DBDocManager server listening on port ${PORT}`));
