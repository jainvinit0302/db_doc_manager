
// ============================================
// frontend/src/components/ERDiagram.jsx - CORRECTED
// ============================================
import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

export default function ERDiagram({ processedData }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });

    const def = buildMermaid(processedData);
    const uid = "er-" + Math.random().toString(36).slice(2, 9);

    // Render with error handling
    mermaid
      .render(uid, def)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
        setError(err.message);
      });
  }, [processedData]);

  if (error) {
    return (
      <div>
        <h3>ER Diagram</h3>
        <div className="er-canvas">
          <div style={{ color: "#f87171", padding: 16 }}>
            ⚠️ Failed to render ER Diagram: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3>ER Diagram</h3>
      <div className="er-canvas" ref={containerRef}>
        <em style={{ color: "#94a3b8" }}>Rendering diagram...</em>
      </div>
    </div>
  );
}

function buildMermaid(processedData) {
  const erd = processedData?.erd;
  
  // If backend already generated ERD, use it
  if (erd && typeof erd === 'string' && erd.includes('erDiagram')) {
    return erd;
  }

  // Otherwise generate from targets
  if (!processedData?.targets || processedData.targets.length === 0) {
    return `
      erDiagram
      CUSTOMER {
        INT id PK
        string name
        string email
      }
      ORDER {
        INT id PK
        INT customer_id FK
        string item
      }
      CUSTOMER ||--o{ ORDER : places
    `;
  }

  let def = "erDiagram\n";

  processedData.targets.forEach((t) => {
    const tableLabel = safeTableLabel(t.schema + "_" + (t.tables?.[0]?.name || t.name || "TABLE"));
    
    def += `  ${tableLabel} {\n`;
    
    if (t.tables && t.tables[0] && t.tables[0].columns) {
      t.tables[0].columns.forEach((c) => {
        if (!c || !c.name) return;
        const colType = (c.type || "string").toLowerCase().split("(")[0];
        const pkMark = c.pk ? " PK" : "";
        const ukMark = c.unique && !c.pk ? " UK" : "";
        def += `    ${colType} ${c.name}${pkMark}${ukMark}\n`;
      });
    }
    
    def += "  }\n";
  });

  // Add relationships if multiple tables
  if (processedData.targets.length >= 2) {
    const t1 = processedData.targets[0];
    const t2 = processedData.targets[1];
    const a = safeTableLabel(t1.schema + "_" + (t1.tables?.[0]?.name || t1.name || "TABLE"));
    const b = safeTableLabel(t2.schema + "_" + (t2.tables?.[0]?.name || t2.name || "TABLE"));
    def += `  ${a} ||--o{ ${b} : relates\n`;
  }

  return def;
}

function safeTableLabel(name) {
  if (!name) return "UNKNOWN";
  return String(name)
    .split(".")
    .pop()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toUpperCase();
}
