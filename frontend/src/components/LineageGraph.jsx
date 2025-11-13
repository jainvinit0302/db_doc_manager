// frontend/src/components/LineageGraph.jsx
import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";

export default function LineageGraph({ processedData }) {
  const divRef = useRef(null);
  const cyRef = useRef(null);
  const [graphName, setGraphName] = useState("Data Lineage Graph");

  useEffect(() => {
    if (!divRef.current || !processedData) return;

    // Set graph name from project
    if (processedData.project) {
      setGraphName(`${processedData.project} - Lineage`);
    }

    // Cleanup previous
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const lineageData = processedData.lineage?.nodes || processedData.lineage || [];
    const elements = buildElements(lineageData);

    cyRef.current = cytoscape({
      container: divRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            color: "#fff",
            "font-size": "11px",
            "font-family": "Inter, system-ui, sans-serif",
            "background-color": "#3b82f6",
            width: "label",
            height: "label",
            padding: "12px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
          },
        },
        {
          selector: ".source",
          style: {
            "background-color": "#f97316",
            shape: "round-rectangle",
          },
        },
        {
          selector: ".target",
          style: {
            "background-color": "#10b981",
            shape: "round-rectangle",
          },
        },
        {
          selector: ".generated",
          style: {
            "background-color": "#8b5cf6",
            shape: "diamond",
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            width: 2,
            label: "data(label)",
            "font-size": "10px",
            color: "#94a3b8",
            "text-background-color": "#0f172a",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.5,
        padding: 30,
        animate: true,
        animationDuration: 500,
      },
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [processedData]);

  return (
    <div style={{ height: "100%" }}>
      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{graphName}</h3>
        {processedData?.lineage?.summary && (
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
            {processedData.lineage.summary.totalMappings} mappings from{" "}
            {processedData.lineage.summary.sources} source(s) to{" "}
            {processedData.lineage.summary.targets} target(s)
          </p>
        )}
      </div>

      <div className="lineage-canvas" ref={divRef}>
        <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>
          Building lineage graph...
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        marginTop: 12, 
        padding: 8, 
        background: "var(--card)", 
        borderRadius: 6,
        border: "1px solid var(--border)",
        display: "flex",
        gap: 16,
        fontSize: 11,
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "#f97316" }}></div>
          <span>Source</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "#10b981" }}></div>
          <span>Target</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "#8b5cf6", transform: "rotate(45deg)" }}></div>
          <span>Generated</span>
        </div>
      </div>
    </div>
  );
}

function buildElements(lineageData) {
  if (!lineageData || lineageData.length === 0) {
    return [
      { data: { id: "s1", label: "No Data" }, classes: "source" },
      { data: { id: "t1", label: "Process YAML" }, classes: "target" },
      { data: { id: "e1", source: "s1", target: "t1" } },
    ];
  }

  const nodes = new Map();
  const edges = [];

  lineageData.forEach((item, idx) => {
    const srcId = `src:${item.source || 'unknown'}`;
    const tgtId = `tgt:${item.target || 'unknown'}`;

    if (!nodes.has(srcId)) {
      const label = (item.source || 'unknown').split('.').slice(-2).join('.');
      nodes.set(srcId, {
        data: { id: srcId, label },
        classes: item.type === 'generated' ? 'generated' : 'source',
      });
    }

    if (!nodes.has(tgtId)) {
      const label = (item.target || 'unknown').split('.').slice(-2).join('.');
      nodes.set(tgtId, {
        data: { id: tgtId, label },
        classes: 'target',
      });
    }

    edges.push({
      data: {
        id: `e${idx}`,
        source: srcId,
        target: tgtId,
        label: item.transform || '',
      },
    });
  });

  return [...Array.from(nodes.values()), ...edges];
}