// frontend/src/components/ERDiagram.jsx
import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

export default function ERDiagram({ processedData }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [diagramName, setDiagramName] = useState("Entity Relationship Diagram");

  useEffect(() => {
    if (!containerRef.current || !processedData) return;

    // Set diagram name from project
    if (processedData.project) {
      setDiagramName(`${processedData.project} - ER Diagram`);
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        primaryColor: "#1e293b",
        primaryTextColor: "#e2e8f0",
        primaryBorderColor: "#3b82f6",
        lineColor: "#64748b",
        secondaryColor: "#0f172a",
        tertiaryColor: "#334155",
        fontSize: "14px",
        fontFamily: "Inter, system-ui, sans-serif",
      },
    });

    const erd = processedData.erd || "erDiagram\n  NO_DATA[No data]";
    const uid = "erd-" + Math.random().toString(36).slice(2, 9);

    mermaid
      .render(uid, erd)
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

  return (
    <div style={{ height: "100%" }}>
      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{diagramName}</h3>
        {processedData?.documentation?.summary && (
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
            {processedData.documentation.summary.totalTables} tables across{" "}
            {processedData.documentation.summary.totalTargets} target(s)
          </p>
        )}
      </div>

      {error ? (
        <div className="er-canvas" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#ef4444" }}>
            <p style={{ fontSize: 14 }}>⚠️ Failed to render diagram</p>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{error}</p>
          </div>
        </div>
      ) : (
        <div className="er-canvas" ref={containerRef}>
          <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>
            Rendering diagram...
          </div>
        </div>
      )}
    </div>
  );
}