import React from "react";

export default function ResultViewer({ result, error }) {
  if (error) {
    return <pre className="bg-red-900 p-3 mt-3 rounded">{error}</pre>;
  }
  if (!result) return null;

  return (
    <div className="mt-4">
      <h2 className="text-xl font-semibold mb-2">Parsed & Normalized Output</h2>
      <pre className="bg-gray-800 p-3 rounded text-sm overflow-x-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
