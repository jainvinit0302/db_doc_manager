// frontend/src/components/DbDocPanel.tsx
import React, { useEffect, useRef, useState } from 'react';
import YAML from 'js-yaml';
import mermaid from 'mermaid';
import { validateYaml as clientValidateYaml } from '../services/dbdocApi';
import { generateArtifacts } from '../services/dbdocApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Artifacts = {
  csv?: string;
  mermaids?: Array<{ name: string; content: string }>;
  lineage?: any; // lineage JSON returned from /api/generate
  referentialWarnings?: string[];
};

type DbDocPanelProps = {
  onArtifacts?: (artifacts: Artifacts) => void;
  initialContent?: string;
};

type ValidateResponse = {
  valid: boolean;
  ajvErrors?: any[];
  referentialErrors?: string[];
  referentialWarnings?: string[];
};

export default function DbDocPanel({ onArtifacts, initialContent }: DbDocPanelProps) {
  const [yamlText, setYamlText] = useState<string>(initialContent || '');
  const [busy, setBusy] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(null);
  const [serverErrors, setServerErrors] = useState<string | null>(null);
  const [mermaidFiles, setMermaidFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [csvContent, setCsvContent] = useState<string>('');
  const mermaidRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // basic mermaid init
    mermaid.initialize({ startOnLoad: false });
  }, []);

  useEffect(() => {
  if (!mermaidFiles.length || !mermaidRef.current) return;

  const raw = mermaidFiles[0].content || '';
  const target = mermaidRef.current;
  target.innerHTML = '<div>Rendering...</div>';
  const id = 'mermaidSvg_' + Date.now();

  // helpers ------------------------------------------------------------
  const sanitizeType = (t: string) => {
    if (!t) return 'unknown';
    let s = String(t).trim();
    s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_');
    s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return s.toLowerCase();
  };

  // Repair an erDiagram block: ensure "fieldName type [FLAGS]" per attribute,
  // remove stray characters, ensure newline before closing brace.
  function repairErDiagram(text: string) {
    // split into lines and find blocks
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let inBlock = false;
    let blockIndent = '';
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // detect start of entity block like: "  table_name {"
      if (!inBlock && /\w+\s*\{/.test(trimmed)) {
        inBlock = true;
        // preserve indentation
        const matchIndent = /^(\s*)/.exec(line);
        blockIndent = matchIndent ? matchIndent[1] : '';
        out.push(line.replace(/\s+$/g, '')); // push header as-is (trim trailing spaces)
        continue;
      }

      if (inBlock) {
        // block end
        if (trimmed === '}') {
          // ensure previous line is not empty and trimmed properly
          // ensure closing brace is on its own line (no trailing spaces)
          out.push('  }');
          out.push(''); // blank line between tables
          inBlock = false;
          blockIndent = '';
          continue;
        }

        // attribute candidate lines: try to parse them robustly
        if (trimmed.length === 0) {
          // skip empty lines inside block
          continue;
        }

        // tokens - allow either "type name FLAGS" or "name type FLAGS"
        const toks = trimmed.split(/\s+/).filter(Boolean);
        if (toks.length === 0) continue;

        // Heuristics:
        // - If first token looks like a type (contains letters and maybe underscore, digits), and second looks like field, swap.
        // - If first token is a valid JS identifier (no digits at start) assume it's field name.
        // Decide by checking token patterns:
        const isIdentifier = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
        const tokenLooksLikeType = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && /[a-zA-Z]/.test(s);

        let fieldName = '';
        let typeName = '';
        let flags: string[] = [];

        if (toks.length === 1) {
          // only one token -> treat as field name with unknown type
          fieldName = toks[0];
          typeName = 'unknown';
        } else if (toks.length >= 2) {
          // decide ordering
          if (isIdentifier(toks[0]) && tokenLooksLikeType(toks[1])) {
            // likely "name TYPE ..." e.g., user_id INTEGER
            fieldName = toks[0];
            typeName = toks[1];
            flags = toks.slice(2);
          } else if (tokenLooksLikeType(toks[0]) && isIdentifier(toks[1])) {
            // likely "TYPE name ..." -> swap
            typeName = toks[0];
            fieldName = toks[1];
            flags = toks.slice(2);
          } else {
            // fallback: assume first is name, rest type/flags
            fieldName = toks[0];
            typeName = toks.slice(1).join('_');
            flags = [];
          }
        }

        // sanitize type and flags
        typeName = sanitizeType(typeName || 'unknown');
        flags = flags.map(f => (f || '').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()).filter(Boolean);

        const flagStr = flags.length ? ' ' + flags.join(' ') : '';
        out.push(`    ${fieldName} ${typeName}${flagStr}`.replace(/\s+$/g, ''));
        continue;
      }

      // not in block, pass-through (trim trailing spaces)
      out.push(line.replace(/\s+$/g, ''));
    } // for

    // in case file ended while inside block, close it
    if (inBlock) {
      out.push('  }');
      out.push('');
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // Convert erDiagram to a classDiagram fallback (very tolerant).
  // This is used only if repaired erDiagram still fails.
  function convertErToClassDiagram(text: string) {
  // ensure consistent newlines
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // Collect classes with attributes
  const classes: { name: string; attrs: string[] }[] = [];
  let cur: { name: string; attrs: string[] } | null = null;

  const sanitizeType = (t: string) => {
    if (!t) return 'unknown';
    let s = String(t).trim();
    s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return s.toLowerCase();
  };

  const looksLikeIdentifier = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
  const looksLikeType = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);

  for (const raw of lines) {
    const l = raw.trim();
    // start of block: "<name> {"
    const start = /^([A-Za-z0-9_]+)\s*\{/.exec(l);
    if (start) {
      if (cur) classes.push(cur);
      cur = { name: start[1], attrs: [] };
      continue;
    }
    if (l === '}') {
      if (cur) {
        classes.push(cur);
        cur = null;
      }
      continue;
    }
    if (cur && l.length > 0) {
      // tokens: could be many forms. Try to detect name + type or type + name.
      const toks = l.split(/\s+/).filter(Boolean);
      if (toks.length === 0) continue;

      let name = '';
      let type = 'unknown';

      if (toks.length === 1) {
        // single token -> treat as field name
        name = toks[0];
        type = 'unknown';
      } else {
        // heuristics:
        // If first token looks like a type and second looks like a name -> swap
        if (looksLikeType(toks[0]) && looksLikeIdentifier(toks[1])) {
          // either "type name [FLAGS]" OR "name type" (ambiguous)
          // We'll treat first token as type if second token looks like identifier but first looks like a known type pattern.
          // But prefer treating as "name type" when first token is all-lowercase (commonly type) and second contains '_id' etc.
          // Simpler, pick best guess by checking token patterns:
          const firstLooksLikeType = /^[a-z]/.test(toks[0]) || /^(int|integer|varchar|number|timestamp|date|string|bool|boolean)/i.test(toks[0]);
          if (firstLooksLikeType) {
            type = toks[0];
            name = toks[1];
          } else {
            // fallback - assume name first
            name = toks[0];
            type = toks[1];
          }
        } else {
          // default assume "name type ..." (most common)
          name = toks[0];
          type = toks[1];
        }
      }

      // sanitize and format properly for classDiagram: "+ name : type"
      const safeType = sanitizeType(type || 'unknown');
      const safeName = name.replace(/[^A-Za-z0-9_]/g, '_');
      cur.attrs.push(`+ ${safeName} : ${safeType}`);
    }
  }

  // Build classDiagram text
  const out: string[] = ['classDiagram'];
  for (const c of classes) {
    out.push(`  class ${c.name} {`);
    for (const a of c.attrs) out.push(`    ${a}`);
    out.push('  }');
    out.push('');
  }
  return out.join('\n');
}

  // render attempt with retries ---------------------------------------
  (async () => {
    // Try direct render first (modern mermaid returns Promise<{svg,...}>)
    try {
      const { svg } = await mermaid.render(id, raw);
      target.innerHTML = svg;
      return;
    } catch (err1: any) {
      console.warn('Mermaid initial render failed, attempting repair:', err1?.message || err1);
    }

    // Try repaired erDiagram
    try {
      const repaired = repairErDiagram(raw);
      const { svg } = await mermaid.render(id + '_r', repaired);
      target.innerHTML = svg;
      return;
    } catch (err2: any) {
      console.warn('Mermaid render after repair failed:', err2?.message || err2);
    }

    // Fallback: convert to classDiagram and render
    try {
      const cls = convertErToClassDiagram(raw);
      const { svg } = await mermaid.render(id + '_class', cls);
      target.innerHTML = svg;
      return;
    } catch (err3: any) {
      console.error('Mermaid classDiagram fallback failed:', err3);
      target.innerHTML = '<div style="color:red">Mermaid render failed: ' + String(err3) + '</div>';
    }
  })();
}, [mermaidFiles]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setYamlText(String(reader.result || ''));
      setValidateResult(null);
      setMermaidFiles([]);
      setCsvContent('');
    };
    reader.readAsText(f);
  }

  async function onValidate() {
    setBusy(true);
    setServerErrors(null);
    try {
      const res = await clientValidateYaml(yamlText);
      setValidateResult(res);
    } catch (err: any) {
      setServerErrors(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    setBusy(true);
    setServerErrors(null);
    try {
      const res = await generateArtifacts(yamlText);
      // res = { csv, mermaids: [{name,content}], lineage, referentialWarnings }
      setCsvContent(res.csv || '');
      setMermaidFiles(res.mermaids || []);

      // notify parent if callback provided
      if (onArtifacts) {
        onArtifacts({
          csv: res.csv,
          mermaids: res.mermaids,
          lineage: res.lineage,
          referentialWarnings: res.referentialWarnings
        });
      }

      // also reflect validation info if present
      setValidateResult({
        valid: true,
        ajvErrors: [],
        referentialErrors: res.referentialErrors || [],
        referentialWarnings: res.referentialWarnings || []
      });
    } catch (err: any) {
      // existing error handling (unchanged)
      if (err && err.ajvErrors) {
        setValidateResult({
          valid: false,
          ajvErrors: err.ajvErrors,
          referentialErrors: err.referentialErrors || [],
          referentialWarnings: err.referentialWarnings || []
        });
      } else if (err && err.error) {
        setServerErrors(JSON.stringify(err));
      } else {
        setServerErrors(String(err?.message || err));
      }
      setCsvContent('');
      setMermaidFiles([]);
    } finally {
      setBusy(false);
    }
  }

  // Auto-generate artifacts when initial content is provided
  useEffect(() => {
    if (initialContent && initialContent.trim()) {
      onGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  function downloadCSV() {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapping_matrix.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Optional: client-side quick YAML parse check to give instant feedback before sending to server
  const quickYamlError = (() => {
    if (!yamlText) return null;
    try {
      YAML.load(yamlText);
      return null;
    } catch (e: any) {
      return e?.message || String(e);
    }
  })();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="flex-1">
          <div className="text-sm mb-1">Paste DSL (YAML)</div>
          <textarea
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            rows={12}
            className="w-full p-3 border border-border rounded-md bg-card"
            placeholder="Paste your .dbdoc YAML here..."
          />
        </label>

        <div className="w-48 space-y-2">
          <div>
            <div className="text-sm mb-1">Upload file</div>
            <Input type="file" onChange={onFileChange} />
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={onValidate} disabled={busy || !yamlText}>
              {busy ? 'Validating...' : 'Validate (server)'}
            </Button>
            <Button onClick={onGenerate} disabled={busy || !yamlText}>
              {busy ? 'Generating...' : 'Generate Artifacts'}
            </Button>
            <Button onClick={downloadCSV} disabled={!csvContent}>
              Download CSV
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium">Quick YAML parse</h4>
        <div className={`p-2 rounded ${quickYamlError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {quickYamlError || 'YAML looks parseable'}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium">Server validation</h4>
        {serverErrors && <div className="text-red-600 mb-2">{serverErrors}</div>}
        {validateResult ? (
          <div>
            <div className={`p-2 rounded ${validateResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {validateResult.valid ? 'Server: valid' : 'Server: invalid'}
            </div>

            {validateResult.ajvErrors && validateResult.ajvErrors.length > 0 && (
              <div className="mt-2 text-sm">
                <strong>Schema errors:</strong>
                <ul className="list-disc pl-5">
                  {validateResult.ajvErrors.map((e, i) => (
                    <li key={i}>{String(e?.instancePath || '')} — {String(e?.message || JSON.stringify(e))}</li>
                  ))}
                </ul>
              </div>
            )}

            {validateResult.referentialErrors && validateResult.referentialErrors.length > 0 && (
              <div className="mt-2 text-sm text-red-700">
                <strong>Referential errors:</strong>
                <ul className="list-disc pl-5">
                  {validateResult.referentialErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {validateResult.referentialWarnings && validateResult.referentialWarnings.length > 0 && (
              <div className="mt-2 text-sm text-orange-700">
                <strong>Referential warnings:</strong>
                <ul className="list-disc pl-5">
                  {validateResult.referentialWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No validation performed yet.</div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium">ERD Preview</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <div ref={mermaidRef} id="mermaid-preview" />
          {!mermaidFiles.length && <div className="text-sm text-muted-foreground">No ERD yet — generate artifacts to preview</div>}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium">Mapping CSV (preview)</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <pre className="whitespace-pre-wrap max-h-56 overflow-auto text-sm">{csvContent || 'No CSV generated yet.'}</pre>
        </div>
      </div>
    </div>
  );
}
