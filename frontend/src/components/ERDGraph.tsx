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
import { Database, Key, AlertCircle, Check, Hash } from 'lucide-react';

// --- Types ---
interface ERDGraphProps {
    data: Record<string, any>; // The 'erd' object from API (ast.targets)
    className?: string;
}

// --- Custom Node Component ---
const TableNode = ({ data }: NodeProps) => {
    return (
        <div className="bg-card border border-border rounded shadow-sm min-w-[220px] overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-card-foreground" title={`${data.db}.${data.schema}.${data.label}`}>{data.label}</span>
            </div>
            <div className="p-2 space-y-1">
                {data.columns.map((col: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs group relative px-1 py-0.5 hover:bg-muted/30 rounded">
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                            {col.isPk && <Key className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                            {col.isFk && <Key className="w-3 h-3 text-blue-500 flex-shrink-0 rotate-90" />}
                            {!col.isPk && !col.isFk && <Hash className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}

                            <span className={`truncate font-medium ${col.isPk ? 'text-primary' : 'text-card-foreground/80'}`} title={col.name}>
                                {col.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                            <span className="text-muted-foreground/70 font-mono text-[10px]">{col.type}</span>
                            <div className="flex gap-0.5">
                                {col.notNull && <span className="text-[9px] px-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold" title="Not Null">N</span>}
                                {col.unique && <span className="text-[9px] px-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold" title="Unique">U</span>}
                            </div>
                        </div>

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

    const nodeWidth = 240;
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
        const tableKeys = Object.keys(data);
        console.log('ERDGraph: Table keys:', tableKeys);

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        // Build simple name index for smarter lookup
        const simpleNameIndex: Record<string, string[]> = {};
        tableKeys.forEach(key => {
            const t = data[key];
            const simple = t.table;
            if (!simple) return;
            simpleNameIndex[simple] = simpleNameIndex[simple] || [];
            simpleNameIndex[simple].push(key);
        });

        // Helper to find table key by simple name or full name
        const findTableKey = (ref: string, currentSchema: string, currentDb: string) => {
            const simpleRef = ref.split('.').pop() || ref;

            // 1. Try exact match in data keys
            if (data[ref]) return ref;

            // 2. Try simple name index
            const candidates = simpleNameIndex[simpleRef] || [];

            if (candidates.length === 1) return candidates[0];
            if (candidates.length > 1) {
                // Prefer same schema/db
                const sameSchema = candidates.find(k => k.includes(`.${currentSchema}.`));
                if (sameSchema) return sameSchema;

                const sameDb = candidates.find(k => k.startsWith(`${currentDb}.`));
                if (sameDb) return sameDb;
            }

            // 3. Fallback: try case-insensitive match
            const lowerRef = simpleRef.toLowerCase();
            const caseInsensitiveMatch = tableKeys.find(k => {
                const t = data[k];
                return t.table.toLowerCase() === lowerRef;
            });
            if (caseInsensitiveMatch) return caseInsensitiveMatch;

            return candidates[0] || null;
        };

        // 1. Create Nodes
        tableKeys.forEach((key) => {
            const t = data[key];
            const columns = Object.keys(t.columns || {}).map(colName => {
                const col = t.columns[colName];
                return {
                    name: colName,
                    type: col.type,
                    isPk: col.pk || false,
                    isFk: !!col.fk,
                    fk: col.fk,
                    notNull: col.not_null,
                    unique: col.unique,
                    default: col.default
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
                                style: { stroke: '#64748b', strokeWidth: 1.5 },
                                label: colName
                            });
                        } else {
                            console.warn(`ERDGraph: Could not resolve FK ref "${targetRef}" from table "${t.table}"`);
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
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-4 h-0.5 bg-slate-500"></span>
                        <span>Explicit FK</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-0.5 bg-slate-400 border-t border-dashed"></span>
                        <span>Inferred FK</span>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
