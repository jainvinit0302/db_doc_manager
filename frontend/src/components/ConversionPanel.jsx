// frontend/src/components/ConversionPanel.jsx
import React, { useState } from "react";
import { Copy, Download, Check } from "lucide-react";

export default function ConversionPanel({ processedData }) {
  const [selectedDB, setSelectedDB] = useState("postgres");
  const [copied, setCopied] = useState(false);

  if (!processedData) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
        <p>Process YAML to view conversions</p>
      </div>
    );
  }

  const databases = [
    { id: "postgres", label: "PostgreSQL", icon: "🐘" },
    { id: "mysql", label: "MySQL", icon: "🐬" },
    { id: "mongodb", label: "MongoDB", icon: "🍃" },
  ];

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCurrentSQL = () => {
    return processedData.sql?.[selectedDB] || "-- No output generated";
  };

  const getFileName = () => {
    const ext = selectedDB === "mongodb" ? "js" : "sql";
    return `${processedData.project || "schema"}_${selectedDB}.${ext}`;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>
          {processedData.project || "Project"} - Database Schemas
        </h3>
        {processedData.owners && (
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
            Owners: {processedData.owners.join(", ")}
          </p>
        )}
      </div>

      {/* Database Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {databases.map((db) => (
            <button
              key={db.id}
              onClick={() => setSelectedDB(db.id)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid",
                borderColor: selectedDB === db.id ? "#2563eb" : "var(--border)",
                background: selectedDB === db.id ? "rgba(37, 99, 235, 0.15)" : "transparent",
                color: selectedDB === db.id ? "#fff" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span style={{ marginRight: 6 }}>{db.icon}</span>
              {db.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => handleCopy(getCurrentSQL())}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => handleDownload(getCurrentSQL(), getFileName())}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>

      {/* SQL Output */}
      <pre className="result-pre" style={{ maxHeight: 350, minHeight: 200 }}>
        {getCurrentSQL()}
      </pre>

      {/* Summary */}
      {processedData.documentation?.summary && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "var(--card)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>TARGETS</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#10b981" }}>
                {processedData.documentation.summary.totalTargets}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>TABLES</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#3b82f6" }}>
                {processedData.documentation.summary.totalTables}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>MAPPINGS</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#f59e0b" }}>
                {processedData.documentation.summary.totalMappings}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>SOURCES</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#8b5cf6" }}>
                {processedData.documentation.summary.totalSources}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}