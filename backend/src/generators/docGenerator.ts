
// backend/src/generators/docGenerator.ts
// Keep existing but ensure it works

export function generateDocumentation(data: any) {
  return {
    project: data.project || 'Untitled',
    owners: data.owners || [],
    generated: new Date().toISOString(),
    targets: data.targets?.map((t: any) => ({
      db: t.db,
      engine: t.engine,
      schema: t.schema,
      tables: t.tables?.map((tb: any) => ({
        name: tb.name,
        description: tb.description || '',
        columnCount: tb.columns?.length || 0
      })) || []
    })) || [],
    sources: data.sources?.map((s: any) => ({
      id: s.id,
      kind: s.kind,
      location: `${s.db}.${s.collection || s.table || 'data'}`
    })) || [],
    summary: {
      totalTargets: data.targets?.length || 0,
      totalTables: data.targets?.reduce((sum: number, t: any) => sum + (t.tables?.length || 0), 0) || 0,
      totalMappings: data.mappings?.length || 0,
      totalSources: data.sources?.length || 0
    }
  };
}