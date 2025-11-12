import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

/*
  Renders a simple source->target column lineage graph.
  Normalized mappings expected shape:
  { mappings: [{ target, source, path, validTarget }] , targets: [...] }
*/

export default function LineageGraph({ normalized }) {
  const divRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;
    // cleanup previous
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements = buildElements(normalized);

    cyRef.current = cytoscape({
      container: divRef.current,
      elements,
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'text-valign':'center', 'color':'#fff', 'background-color': '#0ea5e9', 'width': 'label', 'padding':'6px' } },
        { selector: '.source', style: { 'background-color': '#f97316' } },
        { selector: '.target', style: { 'background-color': '#10b981' } },
        { selector: 'edge', style: { 'curve-style':'bezier', 'target-arrow-shape':'triangle', 'line-color':'#94a3b8', 'target-arrow-color':'#94a3b8' } }
      ],
      layout: { name: 'cose', animate: true, idealEdgeLength: 80, nodeOverlap: 20 }
    });

    return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };

  }, [normalized]);

  return (
    <div>
      <h3>Lineage Graph</h3>
      <div className="lineage-canvas" ref={divRef}></div>
    </div>
  );
}

function buildElements(normalized) {
  // demo fallback
  if (!normalized || !normalized.mappings) {
    return [
      { data: { id: 's1', label: 'mongo.users' }, classes: 'source' },
      { data: { id: 't1', label: 'dw.dim_user.email' }, classes: 'target' },
      { data: { id: 'e1', source: 's1', target: 't1' } }
    ];
  }

  const nodes = {};
  const edges = [];
  normalized.mappings.forEach((m, idx) => {
    const srcId = `src:${m.source}`;
    const tgtId = `tgt:${m.target}`;
    if (!nodes[srcId]) nodes[srcId] = { data: { id: srcId, label: m.source }, classes: 'source' };
    // use target column as label
    if (!nodes[tgtId]) nodes[tgtId] = { data: { id: tgtId, label: m.target }, classes: 'target' };
    edges.push({ data: { id: `e${idx}`, source: srcId, target: tgtId } });
  });

  return [...Object.values(nodes), ...edges];
}
