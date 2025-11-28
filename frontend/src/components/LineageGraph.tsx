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

const style: any = [
  {
    selector: 'node[type="source"]',
    style: {
      "background-color": "#f59e0b", // amber-500
      "color": "#fff",
      label: "data(label)",
      shape: "round-rectangle",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "12px",
      "font-weight": "bold",
      "border-width": 1,
      "border-color": "#d97706",
    },
  },
  {
    selector: 'node[type="table"]',
    style: {
      "background-color": "#3b82f6", // blue-500
      color: "#fff",
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      shape: "round-rectangle",
      "width": "label",
      "padding": "12px",
      "font-weight": "bold",
      "border-width": 1,
      "border-color": "#2563eb",
    },
  },
  {
    selector: 'node[type="column"]',
    style: {
      "background-color": "#10b981", // emerald-500
      "color": "#fff",
      label: "data(label)",
      shape: "ellipse",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "8px",
      "border-width": 1,
      "border-color": "#059669",
    },
  },
  {
    selector: 'node[type="source_column"]',
    style: {
      "background-color": "#fcd34d", // amber-300
      "color": "#78350f", // amber-900
      label: "data(label)",
      shape: "ellipse",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "8px",
      "border-width": 1,
      "border-color": "#d97706",
    },
  },
  {
    selector: 'node[type="rule"]',
    style: {
      "background-color": "#6366f1", // indigo-500
      "color": "#fff",
      label: "data(label)",
      shape: "diamond",
      "text-valign": "center",
      "text-halign": "center",
      "width": "label",
      "padding": "8px",
      "border-width": 1,
      "border-color": "#4f46e5",
    },
  },
  {
    selector: 'edge[type="column_lineage"]',
    style: {
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "line-color": "#94a3b8", // slate-400
      "target-arrow-color": "#94a3b8",
      width: 2,
      "arrow-scale": 1.2,
    },
  },
  {
    selector: 'edge[type="table_lineage"]',
    style: {
      width: 3,
      "line-color": "#475569", // slate-600
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#475569",
      "arrow-scale": 1.5,
      "curve-style": "bezier",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#ef4444", // red-500
      "background-color": "#f87171",
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
      } catch { }
      cyRef.current = null;
    }
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [],
      style,
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 40,
        edgeSep: 8
      } as any,
      wheelSensitivity: 0.2,
    });

    // basic pan/zoom bindings could be added here
    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch { }
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
            id: te.id || `table_edge_${te.source}_${te.target}_${elements.length}`,
            source: te.source,
            target: te.target,
            type: "table_lineage",
            meta: te.meta || {},
          },
        });
      });
    } else {
      // Column level: Compound nodes (Columns nested in Tables)

      // 1. First, identify and add all PARENT nodes (Tables and Sources)
      // We scan all nodes to find parents, or just add them if they are explicitly in the list.
      // But we also need to ensure parents exist for any column we find.

      (lineage.nodes || []).forEach((n) => {
        if (n.type === "table" || n.type === "source") {
          addNodeIfNeeded(n);
        }
      });

      // 2. Now add CHILD nodes (Columns) and assign them to parents
      (lineage.nodes || []).forEach((n) => {
        if (n.type === "column") {
          // Parent is the table: t:db.schema.table
          // We can derive it from the ID or meta.
          // ID format: t:db.schema.table.colName
          // Parent ID: t:db.schema.table
          // Or use meta.table if available.

          let parentId = null;
          if (n.meta && n.meta.table) {
            parentId = `t:${n.meta.table}`;
          } else {
            // fallback try to parse ID
            const parts = n.id.split('.');
            if (parts.length > 1) {
              parentId = parts.slice(0, -1).join('.');
            }
          }

          // Ensure parent exists
          if (parentId && !addedNodeIds.has(parentId)) {
            // If parent not found in nodes list, create synthetic one
            addNodeIfNeeded({ id: parentId, label: parentId, type: "table", meta: {} });
          }

          // Add the column node with parent reference
          if (!addedNodeIds.has(n.id)) {
            addedNodeIds.add(n.id);
            elements.push({
              data: {
                id: n.id,
                label: n.label || n.id,
                type: n.type,
                parent: parentId, // This makes it a compound node
                meta: n.meta || {},
              },
            });
          }
        } else if (n.type === "source_column") {
          // Parent is the source: src:source_id
          let parentId = null;
          if (n.meta && n.meta.source_id) {
            parentId = `src:${n.meta.source_id}`;
          }

          if (parentId && !addedNodeIds.has(parentId)) {
            addNodeIfNeeded({ id: parentId, label: parentId, type: "source", meta: {} });
          }

          if (!addedNodeIds.has(n.id)) {
            addedNodeIds.add(n.id);
            elements.push({
              data: {
                id: n.id,
                label: n.label || n.id,
                type: n.type,
                parent: parentId,
                meta: n.meta || {},
              },
            });
          }
        } else if (n.type === "rule") {
          // Rules are usually free-floating or could be grouped. Let's keep them free for now.
          addNodeIfNeeded(n);
        }
      });

      // 3. Add Edges
      (lineage.edges || []).forEach((e) => {
        // Ensure endpoints exist (though they should have been added above)
        if (!addedNodeIds.has(e.source)) {
          // If missing, add as free node (fallback)
          addNodeIfNeeded({ id: e.source, label: e.source, type: "node", meta: {} });
        }
        if (!addedNodeIds.has(e.target)) {
          addNodeIfNeeded({ id: e.target, label: e.target, type: "node", meta: {} });
        }

        elements.push({
          data: {
            id: e.id || `column_edge_${e.source}_${e.target}_${elements.length}`,
            source: e.source,
            target: e.target,
            type: e.type || "column_lineage",
            meta: e.meta || {},
          },
        });
      });

      // 4. Add Table Edges (optional, but good for context)
      // In a compound graph, edges between parents are allowed.
      (lineage.table_edges || []).forEach((te) => {
        const srcId = te.source;
        const tgtId = te.target;

        if (!addedNodeIds.has(srcId)) addNodeIfNeeded({ id: srcId, label: srcId, type: "table", meta: {} });
        if (!addedNodeIds.has(tgtId)) addNodeIfNeeded({ id: tgtId, label: tgtId, type: "table", meta: {} });

        elements.push({
          data: {
            id: te.id || `table_edge_${te.source}_${te.target}_${elements.length}`,
            source: te.source,
            target: te.target,
            type: "table_lineage",
            meta: te.meta || {},
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
      cy.layout({
        name: "dagre",
        rankDir: "LR",
        nodeSep: 40,
        edgeSep: 8
      } as any).run();
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
