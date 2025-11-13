
// backend/src/generators/lineageGenerator.ts
// Enhanced lineage with better data

export function generateLineage(data: any): any {
  const lineage: any[] = [];
  
  if (!data.mappings || !data.sources) {
    return {
      nodes: [],
      edges: [],
      summary: { totalMappings: 0, sources: 0, targets: 0 }
    };
  }
  
  const sourceMap = new Map();
  data.sources.forEach((s: any) => {
    sourceMap.set(s.id, `${s.kind}:${s.db}.${s.collection || s.table || 'data'}`);
  });
  
  data.mappings.forEach((m: any, idx: number) => {
    const sourceId = m.from?.source_id;
    const sourceName = sourceId ? sourceMap.get(sourceId) || sourceId : 'generated';
    
    lineage.push({
      id: `mapping_${idx}`,
      source: m.from?.path ? `${sourceName}${m.from.path}` : sourceName,
      target: m.target || 'unknown',
      transform: m.from?.transform || null,
      type: sourceId ? 'mapping' : 'generated'
    });
  });
  
  return {
    nodes: lineage,
    summary: {
      totalMappings: lineage.length,
      sources: sourceMap.size,
      targets: new Set(lineage.map(l => l.target.split('.')[0])).size
    }
  };
}