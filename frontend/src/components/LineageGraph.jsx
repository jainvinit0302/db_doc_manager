
// ============================================
// frontend/src/components/LineageGraph.jsx - CORRECTED
// ============================================
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

export default function LineageGraph({ processedData }) {
  const divRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;

    // Cleanup previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements = buildElements(processedData);

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
            "background-color": "#0ea5e9",
            width: "label",
            height: "label",
            padding: "8px",
            "font-size": "11px",
          },
        },
        {
          selector: ".source",
          style: { "background-color": "#f97316" },
        },
        {
          selector: ".target",
          style: { "background-color": "#10b981" },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            width: 2,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        idealEdgeLength: 100,
        nodeOverlap: 20,
        padding: 10,
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
    <div>
      <h3>Lineage Graph</h3>
      <div className="lineage-canvas" ref={divRef}></div>
    </div>
  );
}

function buildElements(processedData) {
  // Use lineage from backend if available
  const lineage = processedData?.lineage;

  if (!lineage || lineage.length === 0) {
    // Demo fallback
    return [
      { data: { id: "s1", label: "mongo.users" }, classes: "source" },
      { data: { id: "t1", label: "dw.dim_user.email" }, classes: "target" },
      { data: { id: "e1", source: "s1", target: "t1" } },
    ];
  }

  const nodes = {};
  const edges = [];

  lineage.forEach((m, idx) => {
    const srcId = `src:${m.source || "unknown"}`;
    const tgtId = `tgt:${m.target || "unknown"}`;

    if (!nodes[srcId]) {
      nodes[srcId] = {
        data: { id: srcId, label: m.source || "unknown" },
        classes: "source",
      };
    }

    if (!nodes[tgtId]) {
      nodes[tgtId] = {
        data: { id: tgtId, label: m.target || "unknown" },
        classes: "target",
      };
    }

    edges.push({
      data: {
        id: `e${idx}`,
        source: srcId,
        target: tgtId,
        label: m.transform || "",
      },
    });
  });

  return [...Object.values(nodes), ...edges];
}
