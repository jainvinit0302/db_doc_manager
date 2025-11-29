// backend/src/server.ts
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import YAML from "js-yaml";
import cors from "cors";

import { validateStructure, normalize } from "./parser";
import { generateMermaidERD, writeMappingCSV, generateLineageJSON } from "./generator";
import { generateSQL, generateDialects } from "./sql_generator";
import { referentialValidate } from "./validator";
import db from "./db";
import { generateToken, hashPassword, comparePassword, authMiddleware, AuthRequest } from "./auth";

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

// ============ Authentication Endpoints ============

// POST /api/auth/signup - User registration
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    // Check if user already exists
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = db.prepare(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
    ).run(email, passwordHash, name);

    const userId = result.lastInsertRowid as number;
    const token = generateToken(userId, email);

    return res.status(201).json({
      token,
      user: { id: userId, email, name }
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login - User login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = db.prepare(
      "SELECT id, email, password_hash, name FROM users WHERE email = ?"
    ).get(email) as any;

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Track login stats
    db.prepare(`
      INSERT INTO usage_stats (user_id, login_count, last_active)
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        login_count = login_count + 1,
        last_active = CURRENT_TIMESTAMP
    `).run(user.id);

    const token = generateToken(user.id, user.email);

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/profile - Get user profile and stats
app.get("/api/profile", authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = db.prepare(
      "SELECT id, email, name, created_at FROM users WHERE id = ?"
    ).get(req.user!.userId) as any;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stats = db.prepare(
      "SELECT login_count, validation_count, generation_count, last_active FROM usage_stats WHERE user_id = ?"
    ).get(req.user!.userId) as any;

    return res.json({
      user,
      stats: stats || {
        login_count: 0,
        validation_count: 0,
        generation_count: 0,
        last_active: user.created_at
      }
    });
  } catch (error: any) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Failed to get profile" });
  }
});

// GET /api/auth/me - Get current user
app.get("/api/auth/me", authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = db.prepare(
      "SELECT id, email, name, created_at FROM users WHERE id = ?"
    ).get(req.user!.userId) as any;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error: any) {
    console.error("Get user error:", error);
    return res.status(500).json({ error: "Failed to get user" });
  }
});

// ============ Project Endpoints ============

// POST /api/projects - Create project
app.post("/api/projects", authMiddleware, (req: AuthRequest, res) => {
  try {
    const { name, dslContent, metadata } = req.body;

    if (!name || !dslContent) {
      return res.status(400).json({ error: "Project name and DSL content are required" });
    }

    // Serialize metadata to JSON string if provided
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const result = db.prepare(
      "INSERT INTO projects (user_id, name, dsl_content, metadata) VALUES (?, ?, ?, ?)"
    ).run(req.user!.userId, name, dslContent, metadataJson);

    const projectId = result.lastInsertRowid as number;
    const project = db.prepare(
      "SELECT id, user_id, name, dsl_content, metadata, created_at, updated_at FROM projects WHERE id = ?"
    ).get(projectId) as any;

    // Parse metadata back to object
    if (project && project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        project.metadata = null;
      }
    }

    return res.status(201).json({ project });
  } catch (error: any) {
    console.error("Create project error:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects - List user's projects
app.get("/api/projects", authMiddleware, (req: AuthRequest, res) => {
  try {
    const projects = db.prepare(
      "SELECT id, user_id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
    ).all(req.user!.userId);

    return res.json({ projects });
  } catch (error: any) {
    console.error("List projects error:", error);
    return res.status(500).json({ error: "Failed to list projects" });
  }
});

// GET /api/projects/:id - Get specific project
app.get("/api/projects/:id", authMiddleware, (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = db.prepare(
      "SELECT id, user_id, name, dsl_content, metadata, created_at, updated_at FROM projects WHERE id = ? AND user_id = ?"
    ).get(projectId, req.user!.userId) as any;

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Parse metadata from JSON string
    if (project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        project.metadata = null;
      }
    }

    return res.json({ project });
  } catch (error: any) {
    console.error("Get project error:", error);
    return res.status(500).json({ error: "Failed to get project" });
  }
});

// PUT /api/projects/:id - Update project
app.put("/api/projects/:id", authMiddleware, (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, dslContent, metadata } = req.body;

    // Verify project belongs to user
    const existing = db.prepare(
      "SELECT id FROM projects WHERE id = ? AND user_id = ?"
    ).get(projectId, req.user!.userId);

    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Serialize metadata to JSON string if provided
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    // Update project
    db.prepare(
      "UPDATE projects SET name = ?, dsl_content = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(name || null, dslContent || null, metadataJson, projectId);

    const project = db.prepare(
      "SELECT id, user_id, name, dsl_content, metadata, created_at, updated_at FROM projects WHERE id = ?"
    ).get(projectId) as any;

    // Parse metadata back to object
    if (project && project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        project.metadata = null;
      }
    }

    return res.json({ project });
  } catch (error: any) {
    console.error("Update project error:", error);
    return res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Delete project
app.delete("/api/projects/:id", authMiddleware, (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);

    // Verify project belongs to user
    const existing = db.prepare(
      "SELECT id FROM projects WHERE id = ? AND user_id = ?"
    ).get(projectId, req.user!.userId);

    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }

    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

    return res.json({ message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("Delete project error:", error);
    return res.status(500).json({ error: "Failed to delete project" });
  }
});

// ============ DSL Validation & Generation Endpoints ============

// /api/validate : parse YAML, run JSON-schema (AJV) + referential validation
// /api/validate : parse YAML, run JSON-schema (AJV) + referential validation
app.post("/api/validate", authMiddleware, (req: AuthRequest, res) => {
  try {
    const yamlText =
      typeof req.body === "string"
        ? req.body
        : req.body && (req.body as any).yaml
          ? (req.body as any).yaml
          : null;

    // Pre-process YAML to fix unquoted types with commas (e.g. DECIMAL(10,2))
    if (yamlText) {
      // Regex to find "type: TYPE(X,Y)" and quote it as "type: 'TYPE(X,Y)'"
      // This handles the specific case where the comma breaks the flow-style object
      const fixed = yamlText.replace(/(type:\s*)([a-zA-Z0-9_]+\([0-9]+,\s*[0-9]+\))/g, '$1"$2"');
      // Also handle cases where it might be inside a flow object like { name: x, type: DECIMAL(10,2) }
      // The previous regex works for simple cases, but let's be careful.
      // Actually, simply quoting the value if it looks like a function call with args works best.
    }

    if (!yamlText) {
      return res
        .status(400)
        .json({ error: "Empty request body. Send YAML text in the POST body." });
    }

    let parsed: any;
    try {
      // Fix unquoted types with commas
      const fixedYaml = yamlText.replace(/(type:\s*)([a-zA-Z0-9_]+\([0-9]+,\s*[0-9]+\))/g, '$1"$2"');
      parsed = YAML.load(fixedYaml);
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

    // Track validation stats
    if (req.user) {
      db.prepare(`
        INSERT INTO usage_stats (user_id, validation_count, last_active)
        VALUES (?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          validation_count = validation_count + 1,
          last_active = CURRENT_TIMESTAMP
      `).run(req.user.userId);
    }

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
// /api/generate : authoritative generate — CSV, mermaid .mmd, lineage JSON
app.post("/api/generate", authMiddleware, (req: AuthRequest, res) => {
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
      // Fix unquoted types with commas
      const fixedYaml = yamlText.replace(/(type:\s*)([a-zA-Z0-9_]+\([0-9]+,\s*[0-9]+\))/g, '$1"$2"');
      parsed = YAML.load(fixedYaml);
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

    // Generate SQL Dialects
    let sql: any = {};
    try {
      sql = generateDialects(ast);
    } catch (errSql: any) {
      console.error("SQL generation error:", errSql);
      sql = { error: errSql.message };
    }

    // Track generation stats
    if (req.user) {
      db.prepare(`
        INSERT INTO usage_stats (user_id, generation_count, last_active)
        VALUES (?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          generation_count = generation_count + 1,
          last_active = CURRENT_TIMESTAMP
      `).run(req.user.userId);
    }

    // Respond with all artifacts
    return res.json({
      csv,
      mermaids: mermaidFiles,
      lineage,
      sql, // This is now an object { postgres, snowflake, mongodb }
      erd: ast.targets, // Return structured ERD data for React Flow
      referentialWarnings: refWarnings,
    });
  } catch (err: any) {
    console.error("Generate endpoint error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DBDocManager server listening on port ${PORT}`));
