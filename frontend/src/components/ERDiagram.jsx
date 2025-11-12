// frontend/src/components/ERDiagram.jsx
import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

export default function ERDiagram({ normalized }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
    });

    const def = buildMermaid(normalized);
    const uid = "er-" + Math.random().toString(36).slice(2, 9);

    try {
      mermaid.render(uid, def).then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg;
      });
    } catch (err) {
      console.error("Mermaid render error:", err);
      if (containerRef.current)
        containerRef.current.innerHTML = `<div style="color:#f87171;padding:8px">
          ⚠️ Failed to render ER Diagram: ${err.message}
        </div>`;
    }
  }, [normalized]);

  return (
    <div>
      <h3>ER Diagram</h3>
      <div className="er-canvas" ref={containerRef}>
        <em style={{ color: "#94a3b8" }}>Rendering diagram...</em>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Safe Mermaid builder                                               */
/* ------------------------------------------------------------------ */
function buildMermaid(normalized) {
  if (!normalized || !Array.isArray(normalized.targets) || normalized.targets.length === 0) {
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

  (normalized.targets || []).forEach((t) => {
    // --- Build a fallback name if fullName is missing ---
    const fullName =
      t.fullName ||
      [t.db, t.schema, t.name].filter(Boolean).join(".") ||
      t.name ||
      "UNKNOWN";

    const tableLabel = safeTableLabel(fullName);

    def += `  ${tableLabel} {\n`;
    (t.columns || []).forEach((c) => {
      if (!c || !c.name) return;
      const colType = (c.type || "string").toLowerCase();
      const pkMark = c.pk ? " PK" : "";
      def += `    ${colType} ${c.name}${pkMark}\n`;
    });
    def += "  }\n";
  });

  // Connect first two tables if available
  if (normalized.targets.length >= 2) {
    const a = safeTableLabel(getFullName(normalized.targets[0]));
    const b = safeTableLabel(getFullName(normalized.targets[1]));
    def += `  ${a} ||--o{ ${b} : relates\n`;
  }

  return def;
}

function getFullName(t) {
  return (
    t.fullName ||
    [t.db, t.schema, t.name].filter(Boolean).join(".") ||
    t.name ||
    "UNKNOWN"
  );
}

function safeTableLabel(name) {
  if (!name) return "UNKNOWN";
  const last = String(name).split(".").pop();
  return last.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}
