import React from "react";

export default function Editor({ value, onChange }) {
  return (
    <textarea
      rows={12}
      className="w-full p-3 rounded bg-gray-900 text-sm text-white"
      placeholder="Paste your .dbdoc YAML here..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
