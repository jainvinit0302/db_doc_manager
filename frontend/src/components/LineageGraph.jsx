// // frontend/src/components/LineageGraph.jsx
// import React, { useEffect, useRef, useState } from "react";
// import cytoscape from "cytoscape";

// export default function LineageGraph({ processedData }) {
//   const divRef = useRef(null);
//   const cyRef = useRef(null);
//   const [graphName, setGraphName] = useState("Data Lineage Graph");

//   useEffect(() => {
//     if (!divRef.current || !processedData) return;

//     // Set graph name from project
//     if (processedData.project) {
//       setGraphName(`${processedData.project} - Lineage`);
//     }

//     // Cleanup previous
//     if (cyRef.current) {
//       cyRef.current.destroy();
//       cyRef.current = null;
//     }

//     const lineageData = processedData.lineage?.nodes || processedData.lineage || [];
//     const elements = buildElements(lineageData);

//     cyRef.current = cytoscape({
//       container: divRef.current,
//       elements,
//       style: [
//         {
//           selector: "node",
//           style: {
//             label: "data(label)",
//             "text-valign": "center",
//             "text-halign": "center",
//             color: "#fff",
//             "font-size": "11px",
//             "font-family": "Inter, system-ui, sans-serif",
//             "background-color": "#3b82f6",
//             width: "label",
//             height: "label",
//             padding: "12px",
//             "text-wrap": "wrap",
//             "text-max-width": "120px",
//           },
//         },
//         {
//           selector: ".source",
//           style: {
//             "background-color": "#f97316",
//             shape: "round-rectangle",
//           },
//         },
//         {
//           selector: ".target",
//           style: {
//             "background-color": "#10b981",
//             shape: "round-rectangle",
//           },
//         },
//         {
//           selector: ".generated",
//           style: {
//             "background-color": "#8b5cf6",
//             shape: "diamond",
//           },
//         },
//         {
//           selector: "edge",
//           style: {
//             "curve-style": "bezier",
//             "target-arrow-shape": "triangle",
//             "line-color": "#64748b",
//             "target-arrow-color": "#64748b",
//             width: 2,
//             label: "data(label)",
//             "font-size": "10px",
//             color: "#94a3b8",
//             "text-background-color": "#0f172a",
//             "text-background-opacity": 0.8,
//             "text-background-padding": "2px",
//           },
//         },
//       ],
//       layout: {
//         name: "breadthfirst",
//         directed: true,
//         spacingFactor: 1.5,
//         padding: 30,
//         animate: true,
//         animationDuration: 500,
//       },
//     });

//     return () => {
//       if (cyRef.current) {
//         cyRef.current.destroy();
//         cyRef.current = null;
//       }
//     };
//   }, [processedData]);

//   return (
//     <div style={{ height: "100%" }}>
//       <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
//         <h3 style={{ margin: 0, fontSize: 18 }}>{graphName}</h3>
//         {processedData?.lineage?.summary && (
//           <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
//             {processedData.lineage.summary.totalMappings} mappings from{" "}
//             {processedData.lineage.summary.sources} source(s) to{" "}
//             {processedData.lineage.summary.targets} target(s)
//           </p>
//         )}
//       </div>

//       <div className="lineage-canvas" ref={divRef}>
//         <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>
//           Building lineage graph...
//         </div>
//       </div>

//       {/* Legend */}
//       <div style={{ 
//         marginTop: 12, 
//         padding: 8, 
//         background: "var(--card)", 
//         borderRadius: 6,
//         border: "1px solid var(--border)",
//         display: "flex",
//         gap: 16,
//         fontSize: 11,
//         flexWrap: "wrap"
//       }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//           <div style={{ width: 12, height: 12, borderRadius: 2, background: "#f97316" }}></div>
//           <span>Source</span>
//         </div>
//         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//           <div style={{ width: 12, height: 12, borderRadius: 2, background: "#10b981" }}></div>
//           <span>Target</span>
//         </div>
//         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//           <div style={{ width: 12, height: 12, borderRadius: 2, background: "#8b5cf6", transform: "rotate(45deg)" }}></div>
//           <span>Generated</span>
//         </div>
//       </div>
//     </div>
//   );
// }

// function buildElements(lineageData) {
//   if (!lineageData || lineageData.length === 0) {
//     return [
//       { data: { id: "s1", label: "No Data" }, classes: "source" },
//       { data: { id: "t1", label: "Process YAML" }, classes: "target" },
//       { data: { id: "e1", source: "s1", target: "t1" } },
//     ];
//   }

//   const nodes = new Map();
//   const edges = [];

//   lineageData.forEach((item, idx) => {
//     const srcId = `src:${item.source || 'unknown'}`;
//     const tgtId = `tgt:${item.target || 'unknown'}`;

//     if (!nodes.has(srcId)) {
//       const label = (item.source || 'unknown').split('.').slice(-2).join('.');
//       nodes.set(srcId, {
//         data: { id: srcId, label },
//         classes: item.type === 'generated' ? 'generated' : 'source',
//       });
//     }

//     if (!nodes.has(tgtId)) {
//       const label = (item.target || 'unknown').split('.').slice(-2).join('.');
//       nodes.set(tgtId, {
//         data: { id: tgtId, label },
//         classes: 'target',
//       });
//     }

//     edges.push({
//       data: {
//         id: `e${idx}`,
//         source: srcId,
//         target: tgtId,
//         label: item.transform || '',
//       },
//     });
//   });

//   return [...Array.from(nodes.values()), ...edges];
// }


// frontend/src/components/LineageGraph.jsx
import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";

export default function LineageGraph({ processedData }) {
  const divRef = useRef(null);
  const cyRef = useRef(null);
  const [graphName, setGraphName] = useState("Data Lineage Graph");

  useEffect(() => {
    if (!divRef.current || !processedData) return;

    // Set the graph title
    if (processedData.project) {
      setGraphName(`${processedData.project} - Lineage`);
    }

    // Cleanup previous graph if exists
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const lineageData =
      processedData.lineage?.nodes || processedData.lineage || [];

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
            "arrow-scale": 1.2,
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.4,
        padding: 20,
        animate: false,
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
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>{graphName}</h3>

        {processedData?.lineage?.summary && (
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
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
      <div
        style={{
          marginTop: 12,
          padding: 8,
          background: "var(--card)",
          borderRadius: 6,
          border: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          fontSize: 11,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: "#f97316",
            }}
          ></div>
          <span>Source</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: "#10b981",
            }}
          ></div>
          <span>Target</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: "#8b5cf6",
              transform: "rotate(45deg)",
            }}
          ></div>
          <span>Generated</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* --------------------- buildElements FUNCTION --------------------- */
/* ------------------------------------------------------------------ */
function buildElements(lineageData) {
  if (!lineageData || lineageData.length === 0) {
    return [
      { data: { id: "s1", label: "No Data" }, classes: "source" },
      { data: { id: "t1", label: "Process YAML" }, classes: "target" },
      { data: { id: "e1", source: "s1", target: "t1" } },
    ];
  }

  // Helpers
  const safeId = (str) => String(str || "unknown").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const nodeMap = new Map(); // id -> node object
  const edges = [];

  // quick index: map target column name (last segment) -> array of mapping items (idx)
  const targetIndex = new Map();
  lineageData.forEach((item, idx) => {
    const tgt = String(item.target || "");
    const tgtKey = tgt.split(".").slice(-1)[0]; // last segment
    if (!targetIndex.has(tgtKey)) targetIndex.set(tgtKey, []);
    targetIndex.get(tgtKey).push(idx);
  });
  
  // 1. --- PRE-COMPUTATION: Index all transform/generated nodes by their label and target column ---
  const transformMap = new Map(); // label/transform text OR target column name -> transform node ID
  lineageData.forEach((item, idx) => {
    const transform = item.transform || null;
    const type = item.type || "mapping";
    const rawSource = item.source || "unknown";

    if (transform || type === "generated" || String(rawSource).startsWith("rule:") || String(rawSource).startsWith("default:")) {
      const trLabel = transform ? String(transform) : String(rawSource);
      const trId = `tr_${idx}_${safeId(trLabel)}`; 
      
      // Index by full label/rule (e.g., 'upper', 'sequence("dim_prod_seq")')
      transformMap.set(trLabel, trId); 
      
      // Index by output column name (last segment) (e.g., 'product_name')
      const targetColumn = String(item.target).split(".").slice(-1)[0];
      if (targetColumn) {
          transformMap.set(targetColumn, trId);
      }
    }
  });
  // 2. --- End PRE-COMPUTATION ---


  // create or get node helper
  const ensureNode = (id, label, classes = "source") => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { data: { id, label }, classes });
    }
    return nodeMap.get(id);
  };

  // For each mapping, decide drawing strategy:
  lineageData.forEach((item, idx) => {
    const rawSource = item.source || "unknown";
    const rawTarget = item.target || "unknown";
    const transform = item.transform || null;
    const type = item.type || "mapping";

    const srcNodeId = `src_${safeId(rawSource)}`;
    const tgtNodeId = `tgt_${safeId(rawTarget)}`;

    // Labels: prefer readable short label for typical dotted paths, but show full for rules
    const fmtLabel = (s) => {
      if (!s) return "unknown";
      if (String(s).startsWith("rule:") || String(s).startsWith("default:") || String(s).startsWith("generated:")) {
        // keep readable full
        return String(s).replace(/^rule:/, "rule: ").replace(/^default:/, "default: ");
      }
      const parts = String(s).split(".");
      if (parts.length >= 2) return parts.slice(-2).join(".");
      return String(s);
    };

    // Ensure target node exists (always)
    ensureNode(tgtNodeId, fmtLabel(rawTarget), "target");

    // If there is a transform OR the mapping is generated, create an explicit transform node:
    // - transform present (parseDate, upper, calc(...))
    // - OR type === 'generated' (sequence/default/rule)
    if (transform || type === "generated" || String(rawSource).startsWith("rule:") || String(rawSource).startsWith("default:")) {
      // create transform node
      const trLabel = transform ? String(transform) : String(rawSource);
      const trId = `tr_${idx}_${safeId(trLabel)}`; // unique per mapping
      ensureNode(trId, trLabel, "generated");

      // If there's an explicit source (non-generated), link source -> transform
      if (item.source && !String(item.source).startsWith("rule:") && !String(item.source).startsWith("default:") && item.source !== "unknown") {
        const explicitSrcId = `src_${safeId(item.source)}`;
        ensureNode(explicitSrcId, fmtLabel(item.source), "source");
        edges.push({
          data: { id: `e_src_tr_${idx}`, source: explicitSrcId, target: trId, label: "" },
        });
      }

      // --- CRITICAL FIX: Inter-mapping dependencies ---
      if (transform && typeof transform === "string") {
        // collect bare identifiers: words, underscores, digits (avoid keywords like parseDate)
        const tokens = Array.from(new Set((transform.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || [])));
        // remove common function names (a short blacklist)
        const funcBlacklist = new Set(["calc", "parseDate", "upper", "lower", "concat", "sequence", "default"]);
        const inputTokens = tokens.filter((t) => !funcBlacklist.has(t));

        inputTokens.forEach((tok) => {
          // 1. Try to link to a transform node (diamond) that produces this token/column
          const upstreamTrId = transformMap.get(tok); 
          
          if (upstreamTrId) {
            // Found a transform node (e.g., 'upper') that outputs 'tok'. Link Transform -> Transform
            edges.push({
              data: { id: `e_tok_tr_tr_${idx}_${tok}`, source: upstreamTrId, target: trId, label: "" },
            });
          }
          
          // 2. Fallback: If not an intermediate transform, link to the source that produces the column (e.g., qty/price_per_unit)
          // We look up the source mapping that outputs the column 'tok'
          const tgtIdxs = targetIndex.get(tok) || [];
          if (tgtIdxs.length > 0 && !upstreamTrId) { 
              tgtIdxs.forEach((mi) => {
                  const mItem = lineageData[mi];
                  const candidateSrc = mItem.source || null;
                  if (candidateSrc) {
                      const candSrcId = `src_${safeId(candidateSrc)}`;
                      ensureNode(candSrcId, fmtLabel(candidateSrc), "source");
                      // Link the source that produces the column 'tok' -> Current Transform
                      edges.push({
                          data: { id: `e_tok_src_tr_alt_${idx}_${tok}_${mi}`, source: candSrcId, target: trId, label: "" },
                      });
                  }
              });
          } else if (!upstreamTrId) {
            // Last resort: check if the token is a source column itself (e.g., in `calc(qty * price)` where qty/price are source names)
            lineageData.forEach((mItem, mIdx) => {
              if (mItem.source && String(mItem.source).endsWith(`.${tok}`)) {
                const candSrcId = `src_${safeId(mItem.source)}`;
                ensureNode(candSrcId, fmtLabel(mItem.source), "source");
                edges.push({
                  data: { id: `e_tok_src_tr_${idx}_${tok}_${mIdx}`, source: candSrcId, target: trId, label: "" },
                });
              }
            });
          }
        });
      }
      // --- END CRITICAL FIX ---

      // Finally connect transform -> target
      edges.push({
        data: { id: `e_tr_tgt_${idx}`, source: trId, target: tgtNodeId, label: "" },
      });

      // Done for this mapping
      return;
    }

    // Otherwise: pure mapping with explicit source -> target (no transform)
    // create source node and a direct edge source -> target
    const finalSrcId = srcNodeId;
    ensureNode(finalSrcId, fmtLabel(rawSource), "source");

    edges.push({
      data: { id: `e_src_tgt_${idx}`, source: finalSrcId, target: tgtNodeId, label: "" },
    });
  });

  // convert nodeMap values to array and return combined elements
  const elements = [...Array.from(nodeMap.values()), ...edges];
  return elements;
}