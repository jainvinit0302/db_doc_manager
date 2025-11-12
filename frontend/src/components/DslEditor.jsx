import React from "react";

export default function DslEditor({ value, onChange, onParse, loading=false }) {
  return (
    <div>
      <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:8}}>
        <button className="btn small" onClick={onParse} disabled={loading}>
          {loading ? "Parsing..." : "Parse & Validate"}
        </button>
        <button
          className="tab small"
          onClick={() => {
            // sample quick insert
            onChange(value);
          }}
        >
          Save YAML
        </button>
      </div>

      <textarea
        className="editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
