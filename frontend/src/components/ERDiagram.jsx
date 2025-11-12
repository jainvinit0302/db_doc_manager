import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

/*
  Renders a Mermaid ER diagram built from normalized targets.
  If no normalized data, renders a demo.
*/

export default function ERDiagram({ normalized }) {
  const ref = useRef(null);
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "dark" });
    const def = buildMermaid(normalized);
    // render
    const id = "mermaid-" + Math.random().toString(36).slice(2,9);
    if (!ref.current) return;
    ref.current.innerHTML = `<div class="mermaid">${def}</div>`;
    try { mermaid.init(undefined, ref.current); } catch(e){ console.warn(e); }
  }, [normalized]);

  return (
    <div>
      <h3>ER Diagram</h3>
      <div className="er-canvas" ref={ref}>
        {/* diagram renders here */}
      </div>
    </div>
  );
}

function buildMermaid(normalized) {
  // simple mocker
  if (!normalized || !normalized.targets) {
    return `erDiagram
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
  normalized.targets.forEach(t => {
    const name = t.fullName.split('.').slice(-1)[0];
    def += `  ${name.toUpperCase()} {\n`;
    (t.columns || []).forEach(c => def += `    string ${c}\n`);
    def += `  }\n`;
  });
  // optional: add a sample relation if two tables exist
  if (normalized.targets.length >= 2) {
    const a = normalized.targets[0].fullName.split('.').slice(-1)[0].toUpperCase();
    const b = normalized.targets[1].fullName.split('.').slice(-1)[0].toUpperCase();
    def += `  ${a} ||--o{ ${b} : has\n`;
  }
  return def;
}
