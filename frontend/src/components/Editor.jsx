import React from 'react';

export default function Editor({ value, onChange, onValidate, onGenerate, loading }){
  return (
    <div className="card">
      <h2>DSL Editor</h2>
      <textarea className="editor" value={value} onChange={e=>onChange(e.target.value)} placeholder="Paste your YAML/DSL here..." />
      <div className="buttons">
        <button onClick={onValidate} disabled={loading}>Validate</button>
        <button onClick={onGenerate} disabled={loading}>Generate Artifacts</button>
      </div>
    </div>
  );
}
