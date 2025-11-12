
// ============================================
// frontend/src/components/ConversionPanel.jsx - CORRECTED
// ============================================
import React from "react";

export default function ConversionPanel({ processedData }) {
  if (!processedData) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
        <p>Process YAML to view documentation</p>
      </div>
    );
  }

  const sql = processedData.sql || "-- No SQL generated --";
  const documentation = processedData.documentation || {};

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ marginTop: 0 }}>Project: {processedData.project || "Unknown"}</h3>
        {processedData.owners && processedData.owners.length > 0 && (
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Owners: {processedData.owners.join(", ")}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <strong>SQL DDL</strong>
          <pre className="result-pre">{sql}</pre>
        </div>
        
        <div style={{ flex: 1, minWidth: "300px" }}>
          <strong>Documentation Summary</strong>
          <pre className="result-pre">
            {JSON.stringify(documentation.summary || documentation, null, 2)}
          </pre>
        </div>
      </div>

      {processedData.targets && (
        <div style={{ marginTop: "16px" }}>
          <strong>Targets</strong>
          <div style={{ marginTop: "8px" }}>
            {processedData.targets.map((target, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--card)",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "8px",
                  border: "1px solid var(--border)"
                }}
              >
                <h4 style={{ margin: "0 0 8px 0" }}>
                  {target.db}.{target.schema} ({target.engine})
                </h4>
                {target.tables && target.tables.map((table, tidx) => (
                  <div key={tidx} style={{ marginLeft: "12px", marginTop: "8px" }}>
                    <strong style={{ color: "#10b981" }}>{table.name}</strong>
                    {table.description && (
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                        {table.description}
                      </p>
                    )}
                    {table.columns && (
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        {table.columns.map((col, cidx) => (
                          <div key={cidx} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                            <span style={{ color: "#fbbf24" }}>{col.name}</span>
                            <span style={{ color: "#60a5fa" }}>{col.type}</span>
                            {col.pk && <span style={{ color: "#ef4444" }}>PK</span>}
                            {col.unique && <span style={{ color: "#a78bfa" }}>UQ</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}