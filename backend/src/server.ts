// backend/src/server.ts
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import { parseDbdoc } from "./parser";
import { referentialValidate } from "./validator";

type CacheEntry = {
  projectId: string;
  createdAt: number;
  ast: any;
  mappings: any[];
  lineage: any;
  summary: any;
  referentialWarnings: string[];
};

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(bodyParser.text({ type: ["text/plain", "application/x-yaml", "text/yaml", "application/yaml"] }));

// In-memory cache: projectId -> CacheEntry
const validationCache = new Map<string, CacheEntry>();

// TTL cleanup: remove entries older than TTL_MS
const TTL_MS = 1000 * 60 * 60; // 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of validationCache.entries()) {
    if (now - v.createdAt > TTL_MS) {
      validationCache.delete(k);
    }
  }
}, 1000 * 60 * 10); // run cleanup every 10 minutes

app.post("/api/validate", async (req, res) => {
  try {
    const yamlContent = (req.body || "").toString();
    if (!yamlContent || yamlContent.trim().length === 0) {
      return res.status(400).json({ error: "Empty YAML input" });
    }

    // Parse YAML to JS object
    let parsed: any;
    try {
      parsed = yaml.load(yamlContent);
    } catch (err: any) {
      return res.status(200).json({
        valid: false,
        structureErrors: [{ message: "YAML parse error", details: err.message }],
      });
    }

    // Structural validation + normalization
    const { ast, errors } = parseDbdoc(parsed);
    if (errors && errors.length > 0) {
      return res.status(200).json({
        valid: false,
        structureErrors: errors,
      });
    }

    // Referential / logical validation
    const { warnings: referentialWarnings } = referentialValidate(ast);

    // Prepare artifacts (mappings, lineage, summary)
    const mappings = ast.mappings || [];
    const lineage = ast.lineage || buildLineageFromAstFallback(ast);
    const summary = {
      sources: Object.keys(ast.sources || {}).length,
      targets: Object.keys(ast.targets || {}).length,
      mappings: (ast.mappings || []).length,
    };

    // Cache the result in memory with projectId
    const projectId = uuidv4();
    validationCache.set(projectId, {
      projectId,
      createdAt: Date.now(),
      ast,
      mappings,
      lineage,
      summary,
      referentialWarnings,
    });

    return res.status(200).json({
      valid: true,
      projectId,
      structureErrors: [],
      referentialWarnings,
      summary,
      mappings,
      lineage,
      ast,
    });
  } catch (err: any) {
    console.error("Validation endpoint error:", err);
    return res.status(500).json({ error: "Validation failed", details: err.message });
  }
});

// Retrieve cached artifacts by projectId
app.get("/api/artifacts/:projectId", (req, res) => {
  const { projectId } = req.params;
  if (!projectId || !validationCache.has(projectId)) {
    return res.status(404).json({ error: "Artifacts not found" });
  }
  const entry = validationCache.get(projectId)!;
  return res.json({
    projectId: entry.projectId,
    createdAt: entry.createdAt,
    ast: entry.ast,
    mappings: entry.mappings,
    lineage: entry.lineage,
    summary: entry.summary,
    referentialWarnings: entry.referentialWarnings,
  });
});

// Very small fallback lineage builder (if your AST doesn't include lineage)
function buildLineageFromAstFallback(ast: any) {
  // Create a minimal lineage graph from mappings if available
  const nodes: any[] = [];
  const edges: any[] = [];
  const addNode = (id: string, type: string, meta: any = {}) => {
    nodes.push({ id, type, ...meta });
  };
  if (ast.targets) {
    for (const t of Object.keys(ast.targets)) {
      addNode(`target:${t}`, "target", { name: t });
    }
  }
  if (ast.sources) {
    for (const s of Object.keys(ast.sources)) {
      addNode(`source:${s}`, "source", { name: s });
    }
  }
  if (ast.mappings && Array.isArray(ast.mappings)) {
    ast.mappings.forEach((m: any, idx: number) => {
      const src = `source:${m.source_id || m.source || "unknown"}`;
      const tgt = `target:${m.target_id || m.target || "unknown"}`;
      edges.push({ id: `e${idx}`, from: src, to: tgt, mapping: m });
    });
  }
  return { nodes, edges };
}

app.listen(PORT, () => {
  console.log(`Validation service running on port ${PORT}`);
});
