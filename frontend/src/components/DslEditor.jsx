// ============================================
// frontend/src/components/DslEditor.jsx - CORRECTED
// ============================================
import React from "react";

export default function DslEditor({ value, onChange }) {
  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>YAML Input</span>
      </div>
      <textarea
        className="editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Enter your DBDoc YAML schema here..."
      />
    </div>
  );
}