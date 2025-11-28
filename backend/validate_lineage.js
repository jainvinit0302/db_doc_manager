export function generateLineage(ast) {
  const nodes = [];
  const edges = [];
  const tableEdges = [];

  // Utility ------------------------------
  const tableId = (t) => `t:${t.table}`;
  const columnId = (t, c) => `t:${t.table}:${c}`;
  const sourceColumnId = (src, path) => `src:${src}:${path}`;
  const ruleId = (ruleName) => `rule:${ruleName}`;

  // --------------------------------------
  // 1. SOURCE NODES
  // --------------------------------------
  for (const src of ast.sources) {
    nodes.push({
      id: `src:${src.id}`,
      type: "source",
      label: src.id,
      meta: src
    });
  }

  // --------------------------------------
  // 2. TARGET TABLE + COLUMN NODES
  // --------------------------------------
  for (const t of Object.values(ast.targets)) {
    nodes.push({
      id: tableId(t),
      type: "table",
      label: `${t.db}.${t.schema}.${t.table}`,
      meta: t,
    });

    for (const [colName, col] of Object.entries(t.columns)) {
      nodes.push({
        id: columnId(t, colName),
        type: "column",
        label: colName,
        meta: { ...col, table: t.table }
      });
    }
  }

  // --------------------------------------
  // 3. MAPPING → COLUMN LINEAGE EDGES
  // --------------------------------------
  for (const map of ast.mappings) {
    const target = map.target; // e.g. dw.core.dim_user.email
    const [db, schema, table, column] = target.split(".");

    const t = ast.targets[`${db}.${schema}.${table}`];
    if (!t) continue;

    // Handle exploded mappings (*)
    if (column === "*") {
      const fields = map.from.fields;
      for (const [childCol, sourcePath] of Object.entries(fields)) {
        const targetColNode = columnId(t, childCol);

        const sourceNodeID = map.from.source_id
          ? sourceColumnId(map.from.source_id, sourcePath)
          : ruleId(map.from.rule.replace("(", "").replace(")", ""));

        // Create source node if needed
        createSourceColumnNode(nodes, map, sourceNodeID, sourcePath);

        edges.push({
          id: makeEdgeId(),
          source: sourceNodeID,
          target: targetColNode,
          type: "column_lineage",
          meta: {
            transform: null,
            rule: map.from.rule || null,
            raw: `${db}.${schema}.${table}.${childCol}`
          }
        });
      }
    } else {
      const targetColNode = columnId(t, column);

      let sourceNodeID;
      if (map.from.source_id) {
        sourceNodeID = sourceColumnId(map.from.source_id, map.from.path);
        createSourceColumnNode(nodes, map, sourceNodeID, map.from.path);
      } else if (map.from.rule) {
        const cleanRule = map.from.rule
          .replace("sequence('", "")
          .replace("')", "");
        sourceNodeID = ruleId(cleanRule);
        createRuleNode(nodes, cleanRule);
      }

      edges.push({
        id: makeEdgeId(),
        source: sourceNodeID,
        target: targetColNode,
        type: "column_lineage",
        meta: {
          transform: map.from.transform || null,
          rule: map.from.rule || null,
          raw: `${db}.${schema}.${table}.${column}`
        }
      });
    }
  }

  // --------------------------------------
  // 4. TABLE-LEVEL EDGES
  // --------------------------------------
  for (const map of ast.mappings) {
    const target = map.target;
    const [db, schema, table, column] = target.split(".");
    const t = ast.targets[`${db}.${schema}.${table}`];
    if (!t) continue;

    let sourceNode = map.from.source_id
      ? `src:${map.from.source_id}`
      : ruleId(map.from.rule.replace("(", "").replace(")", ""));

    const cols = column === "*"
      ? Object.keys(map.from.fields)
      : [column];

    tableEdges.push({
      id: makeTableEdgeId(),
      source: sourceNode,
      target: tableId(t),
      meta: { columns: cols }
    });
  }

  // --------------------------------------
  // Final return
  // --------------------------------------
  return {
    nodes,
    edges,
    table_edges: tableEdges
  };
}

// ----------------------------------------------
// HELPERS
// ----------------------------------------------
function createSourceColumnNode(nodes, map, id, path) {
  if (!nodes.find((n) => n.id === id)) {
    nodes.push({
      id,
      type: "source_column",
      label: path,
      meta: {
        source_id: map.from.source_id,
        path
      }
    });
  }
}

function createRuleNode(nodes, rule) {
  const id = ruleId(rule);
  if (!nodes.find((n) => n.id === id)) {
    nodes.push({
      id,
      type: "rule",
      label: `sequence('${rule}')`,
      meta: { rule: `sequence('${rule}')` }
    });
  }
}

let edgeCounter = 1;
function makeEdgeId() {
  return `e${edgeCounter++}`;
}

let tableEdgeCounter = 1;
function makeTableEdgeId() {
  return `te${tableEdgeCounter++}`;
}
