// frontend/src/components/EnhancedConversionPanel.jsx
import React, { useState } from "react";
import { Database, FileCode, Download, Copy, Check } from "lucide-react";

export default function EnhancedConversionPanel({ processedData }) {
  const [selectedFormat, setSelectedFormat] = useState("postgres");
  const [selectedMongoFormat, setSelectedMongoFormat] = useState("schema");
  const [copied, setCopied] = useState(false);

  if (!processedData) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
        <Database size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
        <p>Process YAML to view conversions</p>
      </div>
    );
  }

  const sqlFormats = [
    { id: "postgres", label: "PostgreSQL", icon: "🐘" },
    { id: "mysql", label: "MySQL", icon: "🐬" },
    { id: "snowflake", label: "Snowflake", icon: "❄️" },
    { id: "unified", label: "All SQL", icon: "📦" },
  ];

  const mongoFormats = [
    { id: "schema", label: "Schema Validation", icon: "📋" },
    { id: "sampleData", label: "Sample Data", icon: "📊" },
    { id: "migrationScript", label: "Migration Script", icon: "🔄" },
    { id: "mappingDoc", label: "Mapping Docs", icon: "📖" },
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
    if (selectedFormat === "unified") {
      return processedData.sql || "";
    }
    return processedData.sqlByEngine?.[selectedFormat] || "";
  };

  const getCurrentMongo = () => {
    return processedData.mongodb?.[selectedMongoFormat] || "";
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Project Info */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>
          {processedData.project || "Project"}
        </h3>
        {processedData.owners && processedData.owners.length > 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Owners: {processedData.owners.join(", ")}
          </p>
        )}
      </div>

      {/* SQL Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={18} />
            SQL DDL Output
          </h4>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleCopy(getCurrentSQL())}
              className="btn small"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px" }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => handleDownload(getCurrentSQL(), `${processedData.project}_${selectedFormat}.sql`)}
              className="btn small"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px" }}
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>

        {/* SQL Format Selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {sqlFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid",
                borderColor: selectedFormat === format.id ? "var(--accent)" : "var(--border)",
                background: selectedFormat === format.id ? "rgba(37, 99, 235, 0.1)" : "transparent",
                color: selectedFormat === format.id ? "#fff" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span style={{ marginRight: 6 }}>{format.icon}</span>
              {format.label}
            </button>
          ))}
        </div>

        {/* SQL Output */}
        <pre className="result-pre" style={{ maxHeight: 300 }}>
          {getCurrentSQL() || "-- No SQL generated --"}
        </pre>
      </div>

      {/* MongoDB Section */}
      {processedData.mongodb && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <FileCode size={18} />
              MongoDB Output
            </h4>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleCopy(getCurrentMongo())}
                className="btn small"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => handleDownload(getCurrentMongo(), `${processedData.project}_mongo_${selectedMongoFormat}.js`)}
                className="btn small"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px" }}
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>

          {/* MongoDB Format Selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {mongoFormats.map((format) => (
              <button
                key={format.id}
                onClick={() => setSelectedMongoFormat(format.id)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: selectedMongoFormat === format.id ? "var(--accent)" : "var(--border)",
                  background: selectedMongoFormat === format.id ? "rgba(37, 99, 235, 0.1)" : "transparent",
                  color: selectedMongoFormat === format.id ? "#fff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ marginRight: 6 }}>{format.icon}</span>
                {format.label}
              </button>
            ))}
          </div>

          {/* MongoDB Output */}
          <pre className="result-pre" style={{ maxHeight: 300 }}>
            {getCurrentMongo() || "// No MongoDB output generated"}
          </pre>
        </div>
      )}

      {/* Summary Stats */}
      {processedData.documentation?.summary && (
        <div style={{ 
          marginTop: 20, 
          padding: 12, 
          background: "var(--card)", 
          borderRadius: 8,
          border: "1px solid var(--border)"
        }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Summary Statistics</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--muted)" }}>Targets</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#10b981" }}>
                {processedData.documentation.summary.totalTargets || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)" }}>Tables</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#3b82f6" }}>
                {processedData.documentation.summary.totalTables || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)" }}>Mappings</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#f59e0b" }}>
                {processedData.documentation.summary.totalMappings || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)" }}>Sources</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#8b5cf6" }}>
                {processedData.sources?.length || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}