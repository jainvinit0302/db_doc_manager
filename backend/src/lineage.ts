import { NormalizedAST } from "./parser";

export function buildLineageGraph(ast: NormalizedAST) {
  const nodes: Record<string, any> = {};
  const edges: any[] = [];

  // --- Build nodes and edges from mappings ---
  for (const mapping of ast.mappings) {
    const { from, target } = mapping;
    if (!from || !target) continue;

    // Source node
    const srcId = from.source_id
      ? `${from.source_id}${from.path ? '.' + from.path : ''}`
      : "unknown_source";
    nodes[srcId] = {
      id: srcId,
      label: srcId,
      type: "source",
    };

    // Target node
    const tgtId = `${target.db}.${target.schema}.${target.table}.${target.column}`;
    nodes[tgtId] = {
      id: tgtId,
      label: tgtId,
      type: "target",
    };

    // Edge
    edges.push({
      id: `${srcId}->${tgtId}`,
      source: srcId,
      target: tgtId,
      transform: from.transform || null,
    });
  }

  return {
    project: ast.project,
    nodes: Object.values(nodes),
    edges,
  };
}
