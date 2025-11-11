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
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.text({ type: ['text/*', 'application/x-yaml', 'application/yaml'], limit: '1mb' }));
app.use(express_1.default.json({ limit: '1mb' }));
function makeTempDir(prefix = 'dbdoc-') {
    const base = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), prefix));
    return base;
}
app.post('/api/validate', (req, res) => {
    try {
        const yamlText = typeof req.body === 'string' ? req.body : (req.body && req.body.yaml ? req.body.yaml : null);
        if (!yamlText)
            return res.status(400).json({ error: 'Empty request body. Send YAML text in the POST body.' });
        let parsed;
        try {
            parsed = js_yaml_1.default.load(yamlText);
        }
        catch (e) {
            return res.status(400).json({ error: 'YAML parse error', detail: String(e.message || e) });
        }
        const ajvResult = (0, parser_1.validateStructure)(parsed);
        const ajvValid = ajvResult.valid;
        const ajvErrors = ajvResult.errors || [];
        const aggregated = { targets: parsed.targets || [], sources: parsed.sources || [], mappings: parsed.mappings || [] };
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
        const valid = ajvValid && (!refErrors || refErrors.length === 0);
        return res.json({ valid, ajvErrors, referentialErrors: refErrors, referentialWarnings: refWarnings });
    }
    catch (err) {
        console.error('Validation endpoint error:', err);
        return res.status(500).json({ error: String(err.message || err) });
    }
});
app.post('/api/generate', (req, res) => {
    try {
        const yamlText = typeof req.body === 'string' ? req.body : (req.body && req.body.yaml ? req.body.yaml : null);
        if (!yamlText)
            return res.status(400).json({ error: 'Empty request body. Send YAML text in the POST body.' });
        let parsed;
        try {
            parsed = js_yaml_1.default.load(yamlText);
        }
        catch (e) {
            return res.status(400).json({ error: 'YAML parse error', detail: String(e.message || e) });
        }
        const ajvResult = (0, parser_1.validateStructure)(parsed);
        const ajvValid = ajvResult.valid;
        const ajvErrors = ajvResult.errors || [];
        const aggregated = { targets: parsed.targets || [], sources: parsed.sources || [], mappings: parsed.mappings || [] };
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
        if (!ajvValid || (refErrors && refErrors.length > 0)) {
            return res.status(400).json({
                error: 'Validation failed',
                ajvErrors,
                referentialErrors: refErrors,
                referentialWarnings: refWarnings
            });
        }
        const tmpDir = makeTempDir('dbdoc-');
        const artifactsDir = path_1.default.join(tmpDir, 'artifacts');
        const erdDir = path_1.default.join(tmpDir, 'erd');
        fs_1.default.mkdirSync(artifactsDir, { recursive: true });
        fs_1.default.mkdirSync(erdDir, { recursive: true });
        (0, generator_1.writeMappingCSV)(ast, artifactsDir);
        (0, generator_1.generateMermaidERD)(ast, erdDir);
        const csvPath = path_1.default.join(artifactsDir, 'mapping_matrix.csv');
        const csv = fs_1.default.existsSync(csvPath) ? fs_1.default.readFileSync(csvPath, 'utf8') : '';
        const mermaidFiles = [];
        if (fs_1.default.existsSync(erdDir)) {
            for (const fname of fs_1.default.readdirSync(erdDir)) {
                const content = fs_1.default.readFileSync(path_1.default.join(erdDir, fname), 'utf8');
                mermaidFiles.push({ name: fname, content });
            }
        }
        return res.json({ csv, mermaids: mermaidFiles, referentialWarnings: refWarnings });
    }
    catch (err) {
        console.error('Generate endpoint error:', err);
        return res.status(500).json({ error: String(err.message || err) });
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DBDocManager server listening on port ${PORT}`));
