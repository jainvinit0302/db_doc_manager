// frontend/src/components/LineageGraph.tsx
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

cytoscape.use(dagre);

type Lineage = {
  nodes: Array<any>;
  edges: Array<any>;
  table_edges?: Array<any>;
};

interface Props {
  lineage: Lineage | null;
  level?: "table" | "column";
  className?: string;
}

const style = [
  {
    selector: 'node[type="source"]',
    style: {
      "background-color": "#FFB020",
      label: "data(label)",
      shape: "round-rectangle",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "8px",
    },
  },
  {
    selector: 'node[type="table"]',
    style: {
      "background-color": "#4F46E5",
      color: "#fff",
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      shape: "rectangle",
      "width": "label",
      "padding": "10px",
    },
  },
  {
    selector: 'node[type="column"]',
    style: {
      "background-color": "#10B981",
      label: "data(label)",
      shape: "ellipse",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "6px",
    },
  },
  {
    selector: 'node[type="rule"]',
    style: {
      "background-color": "#9CA3AF",
      label: "data(label)",
      shape: "diamond",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "8px",
    },
  },
  {
    selector: 'edge[type="column_lineage"]',
    style: {
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "line-color": "#9CA3AF",
      "target-arrow-color": "#9CA3AF",
      width: 2,
    },
  },
  {
    selector: 'edge[type="table_lineage"]',
    style: {
      width: 3,
      "line-color": "#374151",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#374151",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#ef4444",
    },
  },
];

export default function LineageGraph({ lineage, level = "table", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);

  // init cytoscape container once
  useEffect(() => {
    if (!containerRef.current) return;
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch {}
      cyRef.current = null;
    }
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [],
      style,
      layout: { name: "dagre", rankDir: "LR", nodeSep: 40, edgeSep: 8 },
      wheelSensitivity: 0.2,
    });

    // basic pan/zoom bindings could be added here
    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch {}
        cyRef.current = null;
      }
    };
  }, []);

  // update graph when lineage or level changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    // clear previous elements
    cy.elements().remove();

    if (!lineage) {
      return;
    }

    // Build a map of lineage nodes by id for quick lookup
    const nodeById = new Map<string, any>();
    (lineage.nodes || []).forEach((n) => nodeById.set(n.id, n));

    const elements: any[] = [];
    const addedNodeIds = new Set<string>();

    function addNodeIfNeeded(n: any) {
      if (!n || !n.id) return;
      if (addedNodeIds.has(n.id)) return;
      addedNodeIds.add(n.id);
      elements.push({
        data: {
          id: n.id,
          label: n.label || n.id,
          type: n.type || "node",
          meta: n.meta || {},
        },
      });
    }

    if (level === "table") {
      // Table-level: include sources, tables, AND any node referenced by table_edges (could be rule nodes)
      // add all source and table nodes from lineage.nodes
      (lineage.nodes || []).forEach((n) => {
        if (n.type === "source" || n.type === "table" || n.type === "rule") {
          addNodeIfNeeded(n);
        }
      });

      // ensure nodes referenced by table_edges exist (they might be rule:... or table)
      (lineage.table_edges || []).forEach((te) => {
        const srcId = te.source;
        const tgtId = te.target;
        if (nodeById.has(srcId)) addNodeIfNeeded(nodeById.get(srcId));
        else {
          // fallback: create a synthetic node for missing reference
          addNodeIfNeeded({ id: srcId, label: srcId, type: srcId.startsWith("src:") ? "source" : "rule", meta: {} });
        }
        if (nodeById.has(tgtId)) addNodeIfNeeded(nodeById.get(tgtId));
        else {
          addNodeIfNeeded({ id: tgtId, label: tgtId, type: "table", meta: {} });
        }

        // add the table edge
        elements.push({
          data: {
            id: te.id,
            source: te.source,
            target: te.target,
            type: "table_lineage",
            meta: te.meta || {},
          },
        });
      });
    } else {
      // Column level: include source_column, column, rule, and also parent table/source nodes for context
      (lineage.nodes || []).forEach((n) => {
        // include everything useful: source_column, column, rule, source, table
        if (["source_column", "column", "rule", "source", "table"].includes(n.type)) {
          addNodeIfNeeded(n);
        }
      });

      // add all column-level edges
      (lineage.edges || []).forEach((e) => {
        // ensure source/target nodes exist (synthetic if necessary)
        if (!addedNodeIds.has(e.source)) {
          if (nodeById.has(e.source)) addNodeIfNeeded(nodeById.get(e.source));
          else addNodeIfNeeded({ id: e.source, label: e.source, type: e.source.startsWith("src:") ? "source_column" : "node", meta: {} });
        }
        if (!addedNodeIds.has(e.target)) {
          if (nodeById.has(e.target)) addNodeIfNeeded(nodeById.get(e.target));
          else addNodeIfNeeded({ id: e.target, label: e.target, type: "column", meta: {} });
        }

        elements.push({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type || "column_lineage",
            meta: e.meta || {},
          },
        });
      });
    }

    // add everything into cytoscape in bulk
    try {
      cy.add(elements);
    } catch (err) {
      console.error("Cytoscape add(elements) failed:", err, { elementsLength: elements.length });
    }

    // run layout
    try {
      cy.layout({ name: "dagre", rankDir: "LR", nodeSep: 40, edgeSep: 8 }).run();
    } catch (err) {
      console.error("Cytoscape layout failed:", err);
    }

    // simple tap handlers (show metadata in console)
    cy.off("tap");
    cy.on("tap", "node", (evt: any) => {
      const d = evt.target.data();
      console.log("node tapped", d);
    });
    cy.on("tap", "edge", (evt: any) => {
      const d = evt.target.data();
      console.log("edge tapped", d);
    });
  }, [lineage, level]);

  return <div ref={containerRef} className={className || "w-full h-full"} style={{ minHeight: 420 }} />;
}
