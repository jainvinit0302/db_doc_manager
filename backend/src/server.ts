// backend/src/server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import YAML from 'js-yaml';
import cors from 'cors';

import { loadDbdocFiles, validateStructure, normalize } from './parser';
import { writeMappingCSV, generateMermaidERD } from './generator';
import { referentialValidate } from './validator';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.text({ type: ['text/*', 'application/x-yaml', 'application/yaml'], limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

function makeTempDir(prefix = 'dbdoc-') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return base;
}

app.post('/api/validate', (req, res) => {
  try {
    const yamlText = typeof req.body === 'string' ? req.body : (req.body && req.body.yaml ? req.body.yaml : null);
    if (!yamlText) return res.status(400).json({ error: 'Empty request body. Send YAML text in the POST body.' });

    let parsed: any;
    try { parsed = YAML.load(yamlText); } catch (e: any) {
      return res.status(400).json({ error: 'YAML parse error', detail: String(e.message || e) });
    }

    const ajvResult = validateStructure(parsed);
    const ajvValid = ajvResult.valid;
    const ajvErrors = ajvResult.errors || [];

    const aggregated = { targets: parsed.targets || [], sources: parsed.sources || [], mappings: parsed.mappings || [] };
    const ast = normalize(aggregated);
    const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

    const valid = ajvValid && (!refErrors || refErrors.length === 0);

    return res.json({ valid, ajvErrors, referentialErrors: refErrors, referentialWarnings: refWarnings });
  } catch (err: any) {
    console.error('Validation endpoint error:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/api/generate', (req, res) => {
  try {
    const yamlText = typeof req.body === 'string' ? req.body : (req.body && req.body.yaml ? req.body.yaml : null);
    if (!yamlText) return res.status(400).json({ error: 'Empty request body. Send YAML text in the POST body.' });

    let parsed: any;
    try { parsed = YAML.load(yamlText); } catch (e: any) {
      return res.status(400).json({ error: 'YAML parse error', detail: String(e.message || e) });
    }

    const ajvResult = validateStructure(parsed);
    const ajvValid = ajvResult.valid;
    const ajvErrors = ajvResult.errors || [];

    const aggregated = { targets: parsed.targets || [], sources: parsed.sources || [], mappings: parsed.mappings || [] };
    const ast = normalize(aggregated);
    const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

    if (!ajvValid || (refErrors && refErrors.length > 0)) {
      return res.status(400).json({
        error: 'Validation failed',
        ajvErrors,
        referentialErrors: refErrors,
        referentialWarnings: refWarnings
      });
    }

    const tmpDir = makeTempDir('dbdoc-');
    const artifactsDir = path.join(tmpDir, 'artifacts');
    const erdDir = path.join(tmpDir, 'erd');
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.mkdirSync(erdDir, { recursive: true });

    writeMappingCSV(ast, artifactsDir);
    generateMermaidERD(ast, erdDir);

    const csvPath = path.join(artifactsDir, 'mapping_matrix.csv');
    const csv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : '';

    const mermaidFiles: Array<{ name: string; content: string }> = [];
    if (fs.existsSync(erdDir)) {
      for (const fname of fs.readdirSync(erdDir)) {
        const content = fs.readFileSync(path.join(erdDir, fname), 'utf8');
        mermaidFiles.push({ name: fname, content });
      }
    }

    return res.json({ csv, mermaids: mermaidFiles, referentialWarnings: refWarnings });
  } catch (err: any) {
    console.error('Generate endpoint error:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DBDocManager server listening on port ${PORT}`));
