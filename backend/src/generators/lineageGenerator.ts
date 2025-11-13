
// // backend/src/generators/lineageGenerator.ts
// // Enhanced lineage with better data

// export function generateLineage(data: any): any {
//   const lineage: any[] = [];
  
//   if (!data.mappings || !data.sources) {
//     return {
//       nodes: [],
//       edges: [],
//       summary: { totalMappings: 0, sources: 0, targets: 0 }
//     };
//   }
  
//   const sourceMap = new Map();
//   data.sources.forEach((s: any) => {
//     sourceMap.set(s.id, `${s.kind}:${s.db}.${s.collection || s.table || 'data'}`);
//   });
  
//   data.mappings.forEach((m: any, idx: number) => {
//     const sourceId = m.from?.source_id;
//     const sourceName = sourceId ? sourceMap.get(sourceId) || sourceId : 'generated';
    
//     lineage.push({
//       id: `mapping_${idx}`,
//       source: m.from?.path ? `${sourceName}${m.from.path}` : sourceName,
//       target: m.target || 'unknown',
//       transform: m.from?.transform || null,
//       type: sourceId ? 'mapping' : 'generated'
//     });
//   });
  
//   return {
//     nodes: lineage,
//     summary: {
//       totalMappings: lineage.length,
//       sources: sourceMap.size,
//       targets: new Set(lineage.map(l => l.target.split('.')[0])).size
//     }
//   };
// }


// backend/src/generators/lineageGenerator.ts
export function generateLineage(data: any): any {
  const lineage: any[] = [];

  if (!data?.mappings || !Array.isArray(data.mappings)) {
    return {
      nodes: [],
      summary: { totalMappings: 0, sources: 0, targets: 0 },
    };
  }

  // Build source map from provided sources
  const sourceMap = new Map<string, string>();
  if (Array.isArray(data.sources)) {
    data.sources.forEach((s: any) => {
      // Normalize to kind:db.collection or kind:db.table
      const collectionOrTable = s.collection || s.table || "data";
      const dbName = s.db || s.database || "";
      const kind = s.kind || "source";
      sourceMap.set(s.id, `${kind}:${dbName}.${collectionOrTable}`);
    });
  }

  data.mappings.forEach((m: any, idx: number) => {
    // m can be of several shapes:
    // - m.from with source_id + path
    // - m.from with only rule / default (generated)
    // - direct rule (m.from absent but m.rule?), your YAML uses `from: { rule: ... }` style
    const from = m.from || {};
    const sourceId = from.source_id;
    let sourceName: string;
    let transform: string | null = null;
    let type = "mapping";

    if (sourceId) {
      // Real source mapping
      const base = sourceMap.get(sourceId) || sourceId;
      // normalize path (remove leading "$." or "$")
      const rawPath = (from.path || "").toString();
      const cleanedPath = rawPath.replace(/^\$\.*/, "");
      sourceName = cleanedPath ? `${base}.${cleanedPath}` : base;
      transform = from.transform || null;
      type = "mapping";
    } else {
      // No explicit source_id -> generated/derived value
      // Prefer rule, then default, then an explicit mention
      if (from.rule) {
        sourceName = `rule:${from.rule}`;
        transform = from.rule;
      } else if (from?.default !== undefined) {
        sourceName = `default:${String(from.default)}`;
        transform = null;
      } else if (m.rule || m.from?.rule) {
        // sometimes rule may be on root or nested; cover both
        const ruleText = m.rule || from.rule;
        sourceName = `rule:${ruleText}`;
        transform = ruleText;
      } else {
        // fallback unique generated id (use target name to avoid collapsing)
        const tgt = m.target || `unknown_target_${idx}`;
        sourceName = `generated:${tgt}`;
        transform = from.transform || null;
      }
      type = "generated";
    }

    // Set transform for rule-based mappings if not already set
    if (!transform && from.rule) transform = from.rule;
    if (!transform && m.rule) transform = m.rule;

    lineage.push({
      id: `mapping_${idx}`,
      source: sourceName,
      target: m.target || "unknown",
      transform: transform || null,
      type,
    });
  });

  // Compute summary: unique sources and unique targets (table-level)
  const uniqueSources = new Set(lineage.map((l) => l.source));
  const uniqueTargets = new Set<string>();
  lineage.forEach((l) => {
    const t = (l.target || "").toString();
    // If target is column-like (a.b.c), drop last part to group by table
    if (t.includes(".")) {
      const table = t.split(".").slice(0, -1).join(".");
      uniqueTargets.add(table || t);
    } else {
      uniqueTargets.add(t);
    }
  });

  return {
    nodes: lineage,
    summary: {
      totalMappings: lineage.length,
      sources: uniqueSources.size,
      targets: uniqueTargets.size,
    },
  };
}