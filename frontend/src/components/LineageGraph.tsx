// src/components/LineageGraph.tsx
import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import { ZoomIn, ZoomOut, Maximize2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      "background-color": "#FFB020",
      label: "data(label)",
      shape: "round-rectangle",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "14px",
      "font-weight": "600",
      color: "#ffffff",
      "text-outline-color": "#FFB020",
      "text-outline-width": 1,
      width: "label",
      height: "label",
      padding: "12px",
      "min-width": "80px",
      "min-height": "40px",
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
      "font-size": "14px",
      "font-weight": "600",
      "text-outline-color": "#4F46E5",
      "text-outline-width": 1,
      shape: "rectangle",
      width: "label",
      height: "label",
      padding: "14px",
      "min-width": "100px",
      "min-height": "50px",
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
      "font-size": "12px",
      "font-weight": "500",
      color: "#ffffff",
      "text-outline-color": "#10B981",
      "text-outline-width": 1,
      width: "label",
      height: "label",
      padding: "10px",
      "min-width": "70px",
      "min-height": "35px",
    },
  },
  {
    selector: 'node[type="source_column"]',
    style: {
      "background-color": "#F59E0B",
      label: "data(label)",
      shape: "ellipse",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "12px",
      "font-weight": "500",
      color: "#ffffff",
      "text-outline-color": "#F59E0B",
      "text-outline-width": 1,
      width: "label",
      height: "label",
      padding: "10px",
      "min-width": "70px",
      "min-height": "35px",
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
      "font-size": "11px",
      "font-weight": "500",
      color: "#ffffff",
      "text-outline-color": "#9CA3AF",
      "text-outline-width": 1,
      width: "label",
      height: "label",
      padding: "12px",
      "min-width": "60px",
      "min-height": "60px",
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
      "arrow-scale": 1.2,
    },
  },
  {
    selector: 'edge[type="table_lineage"]',
    style: {
      "curve-style": "bezier",
      width: 3,
      "line-color": "#374151",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#374151",
      "arrow-scale": 1.5,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#ef4444",
      "overlay-opacity": 0.2,
      "overlay-color": "#ef4444",
    },
  },
  {
    selector: "edge:selected",
    style: {
      "line-color": "#ef4444",
      "target-arrow-color": "#ef4444",
      width: 4,
    },
  },
  {
    selector: "node:active",
    style: {
      "overlay-opacity": 0.3,
      "overlay-color": "#3b82f6",
    },
  },
];

export default function LineageGraph({ lineage, level = "table", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

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
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 80,
        edgeSep: 20,
        rankSep: 150,
      } as any,
      wheelSensitivity: 0.15,
      minZoom: 0.1,
      maxZoom: 3,
    });

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
      setStats({ nodes: 0, edges: 0 });
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
      // Table-level: include sources, tables, AND any node referenced by table_edges
      (lineage.nodes || []).forEach((n) => {
        if (n.type === "source" || n.type === "table" || n.type === "rule") {
          addNodeIfNeeded(n);
        }
      });

      // ensure nodes referenced by table_edges exist
      (lineage.table_edges || []).forEach((te) => {
        const srcId = te.source;
        const tgtId = te.target;
        if (nodeById.has(srcId)) addNodeIfNeeded(nodeById.get(srcId));
        else {
          addNodeIfNeeded({
            id: srcId,
            label: srcId,
            type: srcId.startsWith("src:") ? "source" : "rule",
            meta: {},
          });
        }
        if (nodeById.has(tgtId)) addNodeIfNeeded(nodeById.get(tgtId));
        else {
          addNodeIfNeeded({ id: tgtId, label: tgtId, type: "table", meta: {} });
        }

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
      // Column level
      (lineage.nodes || []).forEach((n) => {
        if (["source_column", "column", "rule", "source", "table"].includes(n.type)) {
          addNodeIfNeeded(n);
        }
      });

      (lineage.edges || []).forEach((e) => {
        if (!addedNodeIds.has(e.source)) {
          if (nodeById.has(e.source)) addNodeIfNeeded(nodeById.get(e.source));
          else
            addNodeIfNeeded({
              id: e.source,
              label: e.source,
              type: e.source.startsWith("src:") ? "source_column" : "node",
              meta: {},
            });
        }
        if (!addedNodeIds.has(e.target)) {
          if (nodeById.has(e.target)) addNodeIfNeeded(nodeById.get(e.target));
          else addNodeIfNeeded({ id: e.target, label: e.target, type: "column", meta: {} });
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
    }

    // add everything into cytoscape
    try {
      cy.add(elements);
      const nodeCount = elements.filter((e) => !e.data.source).length;
      const edgeCount = elements.filter((e) => e.data.source).length;
      setStats({ nodes: nodeCount, edges: edgeCount });
    } catch (err) {
      console.error("Cytoscape add(elements) failed:", err);
    }

    // run layout
    try {
      const layout = cy.layout({
        name: "dagre",
        rankDir: "LR",
        nodeSep: 80,
        edgeSep: 20,
        rankSep: 150,
      } as any);
      layout.run();
      
      // Fit to viewport after layout completes
      layout.on("layoutstop", () => {
        cy.fit(undefined, 50);
      });
    } catch (err) {
      console.error("Cytoscape layout failed:", err);
    }

    // tap handlers
    cy.off("tap");
    cy.on("tap", "node", (evt: any) => {
      const d = evt.target.data();
      console.log("Node:", d);
    });
    cy.on("tap", "edge", (evt: any) => {
      const d = evt.target.data();
      console.log("Edge:", d);
    });
  }, [lineage, level]);

  const handleZoomIn = () => {
    if (cyRef.current) {
      const zoom = cyRef.current.zoom();
      cyRef.current.zoom({
        level: zoom * 1.2,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 },
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      const zoom = cyRef.current.zoom();
      cyRef.current.zoom({
        level: zoom * 0.8,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 },
      });
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  };

  const handleExport = () => {
    if (cyRef.current) {
      const png = cyRef.current.png({ full: true, scale: 2 });
      const link = document.createElement("a");
      link.href = png;
      link.download = `lineage-${level}-${Date.now()}.png`;
      link.click();
    }
  };

  if (!lineage) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500 p-8">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg font-medium">No lineage data available</p>
          <p className="text-sm mt-2">Generate artifacts from the backend to visualize data lineage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleFit} title="Fit to Screen">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExport} title="Export as PNG">
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 text-xs border">
        <div className="font-semibold mb-2 text-sm">Legend</div>
        <div className="space-y-1.5">
          {level === "table" ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "#FFB020" }}></div>
                <span>Source</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "#4F46E5" }}></div>
                <span>Table</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded rotate-45" style={{ backgroundColor: "#9CA3AF" }}></div>
                <span>Rule</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#F59E0B" }}></div>
                <span>Source Column</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#10B981" }}></div>
                <span>Column</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded rotate-45" style={{ backgroundColor: "#9CA3AF" }}></div>
                <span>Rule</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg px-3 py-2 text-xs border">
        <div className="flex items-center gap-3">
          <span className="font-medium">{stats.nodes} nodes</span>
          <span className="text-gray-400">•</span>
          <span className="font-medium">{stats.edges} edges</span>
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className={className || "w-full h-full"}
        style={{ minHeight: "600px", backgroundColor: "#fafafa" }}
      />
    </div>
  );
}