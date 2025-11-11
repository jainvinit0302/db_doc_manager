"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/server.ts
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const cors_1 = __importDefault(require("cors"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const validator_1 = require("./validator");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: "*" }));
app.use(express_1.default.text({
    type: ["text/*", "application/x-yaml", "application/yaml"],
    limit: "2mb",
}));
app.use(express_1.default.json({ limit: "2mb" }));
function makeTempDir(prefix = "dbdoc-") {
    const base = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), prefix));
    return base;
}
// /api/validate : parse YAML, run JSON-schema (AJV) + referential validation
app.post("/api/validate", (req, res) => {
    try {
        const yamlText = typeof req.body === "string"
            ? req.body
            : req.body && req.body.yaml
                ? req.body.yaml
                : null;
        if (!yamlText) {
            return res
                .status(400)
                .json({ error: "Empty request body. Send YAML text in the POST body." });
        }
        let parsed;
        try {
            parsed = js_yaml_1.default.load(yamlText);
        }
        catch (e) {
            return res
                .status(400)
                .json({ error: "YAML parse error", detail: String(e.message || e) });
        }
        // AJV schema validation (structure)
        const ajvResult = (0, parser_1.validateStructure)(parsed);
        const ajvValid = ajvResult.valid;
        const ajvErrors = ajvResult.errors || [];
        // normalize into AST shape expected by referential validator and generator
        const aggregated = {
            targets: parsed.targets || [],
            sources: parsed.sources || [],
            mappings: parsed.mappings || [],
        };
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
        const valid = ajvValid && (!refErrors || refErrors.length === 0);
        return res.json({
            valid,
            ajvErrors,
            referentialErrors: refErrors,
            referentialWarnings: refWarnings,
        });
    }
    catch (err) {
        console.error("Validation endpoint error:", err);
        return res.status(500).json({ error: String(err.message || err) });
    }
});
// /api/generate : authoritative generate — CSV, mermaid .mmd, lineage JSON
app.post("/api/generate", (req, res) => {
    try {
        const yamlText = typeof req.body === "string"
            ? req.body
            : req.body && req.body.yaml
                ? req.body.yaml
                : null;
        if (!yamlText) {
            return res
                .status(400)
                .json({ error: "Empty request body. Send YAML text in the POST body." });
        }
        let parsed;
        try {
            parsed = js_yaml_1.default.load(yamlText);
        }
        catch (e) {
            return res
                .status(400)
                .json({ error: "YAML parse error", detail: String(e.message || e) });
        }
        // AJV schema validation (structure)
        const ajvResult = (0, parser_1.validateStructure)(parsed);
        const ajvValid = ajvResult.valid;
        const ajvErrors = ajvResult.errors || [];
        // normalize AST for referential validation and generation
        const aggregated = {
            targets: parsed.targets || [],
            sources: parsed.sources || [],
            mappings: parsed.mappings || [],
        };
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
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
        const artifactsDir = path_1.default.join(tmpDir, "artifacts");
        const erdDir = path_1.default.join(tmpDir, "erd");
        const lineageOut = path_1.default.join(tmpDir, "lineage");
        fs_1.default.mkdirSync(artifactsDir, { recursive: true });
        fs_1.default.mkdirSync(erdDir, { recursive: true });
        fs_1.default.mkdirSync(lineageOut, { recursive: true });
        // Generate artifacts
        (0, generator_1.writeMappingCSV)(ast, artifactsDir);
        (0, generator_1.generateMermaidERD)(ast, erdDir);
        // Read CSV
        const csvPath = path_1.default.join(artifactsDir, "mapping_matrix.csv");
        const csv = fs_1.default.existsSync(csvPath) ? fs_1.default.readFileSync(csvPath, "utf8") : "";
        // Read mermaid files
        const mermaidFiles = [];
        if (fs_1.default.existsSync(erdDir)) {
            for (const fname of fs_1.default.readdirSync(erdDir)) {
                const content = fs_1.default.readFileSync(path_1.default.join(erdDir, fname), "utf8");
                mermaidFiles.push({ name: fname, content });
            }
        }
        // Generate lineage JSON (and write lineage.json into lineageOut)
        let lineage = null;
        try {
            lineage = (0, generator_1.generateLineageJSON)(ast, lineageOut);
            // lineage is returned by the generator (object), and a file lineage.json is also written
        }
        catch (errLine) {
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
    }
    catch (err) {
        console.error("Generate endpoint error:", err);
        return res.status(500).json({ error: String(err.message || err) });
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DBDocManager server listening on port ${PORT}`));
