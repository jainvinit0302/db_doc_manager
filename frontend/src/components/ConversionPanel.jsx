import React from "react";

/*
  Shows conversion outputs:
  - SQL DDL (simple generator)
  - Mongo JSON sample
  - Validation errors / messages
*/

export default function ConversionPanel({ parsed, normalized, error, showFull = false }) {
  const sql = generateDDL(normalized);
  const mongo = generateMongoSample(normalized);

  return (
    <div>
      {error && <div style={{ color: "#fca5a5", marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <strong>SQL DDL</strong>
          <pre className="result-pre">{sql}</pre>
        </div>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <strong>Mongo Sample</strong>
          <pre className="result-pre">{mongo}</pre>
        </div>
      </div>

      {showFull && (
        <div style={{ marginTop: 10 }}>
          <strong>Validation / Parsed</strong>
          <pre className="result-pre">
            {parsed ? JSON.stringify(parsed, null, 2) : "No parsed output yet"}
          </pre>
        </div>
      )}
    </div>
  );
}

/* -----------------------------
 * SQL DDL generator
 * ----------------------------- */
function generateDDL(normalized) {
  if (!normalized || !normalized.targets) return "-- No normalized targets yet --";

  return normalized.targets
    .map((t) => {
      const cols = (t.columns || [])
        .map((c) => `  ${c.name} ${c.type || "TEXT"}${c.pk ? " PRIMARY KEY" : ""}`)
        .join(",\n");
      const tableName = t.fullName || [t.db, t.schema, t.name].filter(Boolean).join(".");
      return `CREATE TABLE ${tableName} (\n${cols}\n);\n`;
    })
    .join("\n");
}

/* -----------------------------
 * Mongo sample generator
 * ----------------------------- */
function generateMongoSample(normalized) {
  if (!normalized || !normalized.mappings) return "// No mapping sample";

  const buckets = {};

  // group by source_id
  normalized.mappings.forEach((m) => {
    if (!m || !m.source_id) return;

    const s = m.source_id;
    buckets[s] = buckets[s] || {};

    // derive key name from new fields
    const key =
      m.target_column ||
      (m.target && m.target.split(".").slice(-1)[0]) ||
      "unknown_column";

    buckets[s][key] = m.source_path || "<no path>";
  });

  return JSON.stringify(buckets, null, 2);
}
