// frontend/src/components/LineageGraph.tsx
import React, { useEffect, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

// Location of the lineage.json output file
const LINEAGE_JSON_PATH = '/docs/artifacts/lineage.json';

type GraphData = {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ id: string; source: string; target: string; transform?: string | null }>;
};

export default function LineageGraph() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  useEffect(() => {
    fetch(LINEAGE_JSON_PATH)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch lineage data from ${LINEAGE_JSON_PATH}`);
        return res.json();
      })
      .then(setGraphData)
      .catch(err => console.error('Error loading lineage data:', err));
  }, []);

  if (!graphData) {
    return <div className="text-gray-500 p-4">Loading lineage graph...</div>;
  }

  // Convert JSON data to Cytoscape elements
  const elements = [
    ...graphData.nodes.map(n => ({
      data: { id: n.id, label: n.label, type: n.type }
    })),
    ...graphData.edges.map(e => ({
      data: { id: e.id, source: e.source, target: e.target, label: e.transform || '' }
    }))
  ];

  // Layout and styling
  const layout = { name: 'breadthfirst', directed: true, padding: 20 };

  const stylesheet = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 10,
        'background-color': (ele: any) =>
          ele.data('type') === 'source' ? '#3b82f6' : '#10b981',
        color: '#fff',
        'text-outline-width': 1,
        'text-outline-color': '#222',
        width: 40,
        height: 40,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': '#9ca3af',
        'target-arrow-color': '#9ca3af',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': 8,
        'text-rotation': 'autorotate',
      },
    },
  ];

  return (
    <div className="w-full h-[80vh] border rounded-lg shadow-md bg-gray-50 p-2">
      <CytoscapeComponent
        elements={elements}
        layout={layout}
        stylesheet={stylesheet}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
