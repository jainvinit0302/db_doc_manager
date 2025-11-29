import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Node,
    Edge,
    Handle,
    Position,
    NodeProps,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Database, Key } from 'lucide-react';

// --- Types ---
interface ERDGraphProps {
    data: Record<string, any>; // The 'erd' object from API (ast.targets)
    className?: string;
}

// --- Custom Node Component ---
const TableNode = ({ data }: NodeProps) => {
    return (
        <div className="bg-card border border-border rounded shadow-sm min-w-[200px] overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-card-foreground">{data.label}</span>
            </div>
            <div className="p-2 space-y-1">
                {data.columns.map((col: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs group relative px-1 py-0.5 hover:bg-muted/30 rounded">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            {col.isPk && <Key className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                            {col.isFk && <Key className="w-3 h-3 text-blue-500 flex-shrink-0 rotate-90" />}
                            <span className="truncate text-card-foreground/80 font-medium" title={col.name}>{col.name}</span>
                        </div>
                        <span className="text-muted-foreground/70 font-mono text-[10px] ml-2 flex-shrink-0">{col.type}</span>

                        {/* Handles for connecting edges */}
                        <Handle type="source" position={Position.Right} className="!bg-transparent !border-none !w-1 !h-1 !right-0" />
                        <Handle type="target" position={Position.Left} className="!bg-transparent !border-none !w-1 !h-1 !left-0" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const nodeTypes = {
    table: TableNode,
};

// --- Layout Helper ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 220;
    const nodeHeight = 36; // base height

    dagreGraph.setGraph({ rankdir: 'LR' });

    nodes.forEach((node) => {
        // Estimate height based on columns
        const height = nodeHeight + (node.data.columns.length * 24) + 40;
        dagreGraph.setNode(node.id, { width: nodeWidth, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - (nodeHeight + (node.data.columns.length * 24) + 40) / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

export default function ERDGraph({ data, className }: ERDGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!data) {
            console.log('ERDGraph: No data received');
            return;
        }

        console.log('ERDGraph: Received data:', data);
        console.log('ERDGraph: Number of table keys:', Object.keys(data).length);

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // 1. Create Nodes
        const tableKeys = Object.keys(data);
        console.log('ERDGraph: Table keys:', tableKeys);

        // Helper to find table key by simple name or full name
        const findTableKey = (ref: string, currentSchema: string, currentDb: string) => {
            const simpleRef = ref.split('.').pop() || ref;
            // Try exact match
            if (data[ref]) return ref;
            // Try simple name match
            const candidates = tableKeys.filter(k => {
                const t = data[k];
                return t.table === simpleRef;
            });
            if (candidates.length === 1) return candidates[0];
            if (candidates.length > 1) {
                // Prefer same schema/db
                const sameSchema = candidates.find(k => k.includes(`.${currentSchema}.`));
                if (sameSchema) return sameSchema;
            }
            return candidates[0] || null;
        };

        tableKeys.forEach((key) => {
            const t = data[key];
            const columns = Object.keys(t.columns || {}).map(colName => {
                const col = t.columns[colName];
                return {
                    name: colName,
                    type: col.type,
                    isPk: col.pk || false,
                    isFk: !!col.fk,
                    fk: col.fk
                };
            });

            newNodes.push({
                id: key,
                type: 'table',
                data: {
                    label: t.table,
                    schema: t.schema,
                    db: t.db,
                    columns
                },
                position: { x: 0, y: 0 }, // layout will fix this
            });
        });

        // 2. Create Edges
        tableKeys.forEach((key) => {
            const t = data[key];
            const childKey = key;

            Object.keys(t.columns || {}).forEach(colName => {
                const col = t.columns[colName];

                // Explicit FK
                if (col.fk) {
                    const fkObj = typeof col.fk === 'string' ? { table: col.fk } : col.fk;
                    let targetRef = fkObj.table || fkObj.table_name || fkObj.ref;

                    // Handle "db.schema.table" in fk string
                    if (!targetRef && typeof col.fk === 'string') targetRef = col.fk;

                    if (targetRef) {
                        const parentKey = findTableKey(targetRef, t.schema, t.db);
                        if (parentKey && parentKey !== childKey) {
                            newEdges.push({
                                id: `e-${parentKey}-${childKey}-${colName}`,
                                source: parentKey,
                                target: childKey,
                                type: 'smoothstep',
                                markerEnd: { type: MarkerType.ArrowClosed },
                                animated: false,
                                style: { stroke: '#64748b' },
                                label: colName
                            });
                        }
                    }
                }

                // Inferred FK (simple version)
                else if (colName.toLowerCase().endsWith('_id')) {
                    const base = colName.substring(0, colName.length - 3);
                    const candidates = [base, `dim_${base}`, `${base}s`, `dim_${base}s`];

                    for (const cand of candidates) {
                        const parentKey = findTableKey(cand, t.schema, t.db);
                        if (parentKey && parentKey !== childKey) {
                            newEdges.push({
                                id: `e-inferred-${parentKey}-${childKey}-${colName}`,
                                source: parentKey,
                                target: childKey,
                                type: 'smoothstep',
                                markerEnd: { type: MarkerType.ArrowClosed },
                                animated: true,
                                style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
                                label: colName
                            });
                            break; // match first candidate
                        }
                    }
                }
            });
        });

        const layouted = getLayoutedElements(newNodes, newEdges);
        console.log('ERDGraph: After layout - nodes:', layouted.nodes.length, 'edges:', layouted.edges.length);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        console.log('ERDGraph: State updated with', layouted.nodes.length, 'nodes and', layouted.edges.length, 'edges');

    }, [data, setNodes, setEdges]);

    return (
        <div className={className}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background color="#e2e8f0" gap={16} />
                <Controls />
                <MiniMap
                    nodeColor={() => '#cbd5e1'}
                    maskColor="rgba(241, 245, 249, 0.7)"
                />
                <Panel position="top-right" className="bg-background/80 p-2 rounded border border-border text-xs text-muted-foreground">
                    <div>Solid line: Explicit FK</div>
                    <div>Dashed line: Inferred FK</div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
