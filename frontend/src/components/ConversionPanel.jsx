import React from "react";

/* 
  Shows conversion outputs:
  - SQL DDL (simple generator)
  - Mongo JSON sample
  - Validation errors / messages
*/

export default function ConversionPanel({ parsed, normalized, error, showFull=false }) {
  const sql = generateDDL(normalized);
  const mongo = generateMongoSample(normalized);

  return (
    <div>
      {error && <div style={{color:"#fca5a5", marginBottom:8}}>{error}</div>}
      <div style={{display:"flex", gap:8}}>
        <div style={{flex:1}}>
          <strong>SQL DDL</strong>
          <pre className="result-pre">{sql}</pre>
        </div>
        <div style={{flex:1}}>
          <strong>Mongo Sample</strong>
          <pre className="result-pre">{mongo}</pre>
        </div>
      </div>

      {showFull && <div style={{marginTop:10}}>
        <strong>Validation / Parsed</strong>
        <pre className="result-pre">{parsed ? JSON.stringify(parsed, null, 2) : "No parsed output yet"}</pre>
      </div>}
    </div>
  );
}


// Simple DDL generator from normalized targets (demo style)
function generateDDL(normalized) {
  if (!normalized || !normalized.targets) return "-- No normalized targets yet --";
  return normalized.targets.map(t => {
    const cols = (t.columns || []).map(c => `  ${c} TEXT`).join(",\n");
    return `CREATE TABLE ${t.fullName} (\n${cols}\n);\n`;
  }).join("\n");
}

// Simple Mongo sample generator (from mappings)
function generateMongoSample(normalized) {
  if (!normalized || !normalized.mappings) return "// no mapping sample";
  // group by source
  const buckets = {};
  normalized.mappings.forEach(m => {
    const s = m.source || "unknown";
    buckets[s] = buckets[s] || {};
    // derive JSON key from target name
    const key = m.target.split('.').slice(-1)[0];
    buckets[s][key] = `<from ${m.path || "?"}>`;
  });
  const result = {};
  Object.keys(buckets).forEach(s => result[s] = buckets[s]);
  return JSON.stringify(result, null, 2);
}
