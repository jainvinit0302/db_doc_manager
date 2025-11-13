import { useState, useEffect } from 'react';
import { generateArtifacts } from '@/services/dbdocApi';

interface ParsedTable {
  name: string;
  columns: string[];
}

interface LineageData {
  nodes: any[];
  edges: any[];
  table_edges: any[];
}

export const useDSLParser = (dslContent: string) => {
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  const [lineage, setLineage] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse DSL content to extract tables and columns (kept for backward compatibility)
  const parseDSLContent = (dslContent: string) => {
    if (!dslContent || !dslContent.trim()) {
      setParsedTables([]);
      return;
    }

    try {
      // Parse YAML-like DSL content to extract tables from targets section
      const lines = dslContent.split('\n');
      const tables: ParsedTable[] = [];
      let inTargetsSection = false;
      let inTablesSection = false;
      let currentTable: ParsedTable | null = null;
      let inColumnsSection = false;
      let tableIndentLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const indentLevel = line.length - line.trimStart().length;

        // Check if we're entering targets section
        if (trimmedLine === 'targets:') {
          inTargetsSection = true;
          continue;
        }

        // Exit targets section if we hit another top-level section (sources, mappings, etc.)
        if (inTargetsSection && indentLevel === 0 && trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
          if (!['tables:', 'db:', 'engine:', 'schema:'].some(keyword => trimmedLine.startsWith(keyword))) {
            inTargetsSection = false;
            inTablesSection = false;
            inColumnsSection = false;
          }
        }

        // Skip if not in targets section
        if (!inTargetsSection) continue;

        // Check for tables section
        if (trimmedLine === 'tables:') {
          inTablesSection = true;
          inColumnsSection = false;
          continue;
        }

        // Skip if not in tables section
        if (!inTablesSection) continue;

        // Check for new table definition (- name: table_name at the tables level)
        if (trimmedLine.startsWith('- name:') && indentLevel <= 8) { // Tables should be at a specific indent level
          // Save previous table if exists
          if (currentTable) {
            tables.push(currentTable);
          }
          
          const tableNameMatch = trimmedLine.match(/- name:\s*(.+)/);
          if (tableNameMatch) {
            currentTable = {
              name: tableNameMatch[1].trim(),
              columns: []
            };
            tableIndentLevel = indentLevel;
            inColumnsSection = false;
          }
        }
        
        // Check for columns section within a table
        else if (currentTable && trimmedLine === 'columns:' && indentLevel > tableIndentLevel) {
          inColumnsSection = true;
          continue;
        }
        
        // Only process column definitions if we're in a columns section
        else if (currentTable && inColumnsSection) {
          // Handle inline column definition like: - { name: product_id, type: INTEGER, pk: true }
          if (trimmedLine.startsWith('- {') && trimmedLine.includes('name:')) {
            const nameMatch = trimmedLine.match(/name:\s*([^,}]+)/);
            const typeMatch = trimmedLine.match(/type:\s*([^,}]+)/);
            
            if (nameMatch) {
              const columnName = nameMatch[1].trim();
              const columnType = typeMatch ? typeMatch[1].trim() : 'unknown';
              currentTable.columns.push(`${columnName} : ${columnType}`);
            }
          }
          
          // Handle multi-line column definitions (- name: followed by type:)
          else if (trimmedLine.startsWith('- name:')) {
            const columnNameMatch = trimmedLine.match(/- name:\s*(.+)/);
            if (columnNameMatch) {
              const columnName = columnNameMatch[1].trim();
              
              // Look ahead for type information in the next few lines
              let columnType = 'unknown';
              for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const nextLine = lines[j].trim();
                const typeMatch = nextLine.match(/type:\s*(.+)/);
                if (typeMatch) {
                  columnType = typeMatch[1].trim();
                  break;
                }
                // Stop looking if we hit another column, table, or section
                if (nextLine.startsWith('- ') || 
                    (lines[j].length - lines[j].trimStart().length <= tableIndentLevel && lines[j].trim() !== '')) {
                  break;
                }
              }
              
              currentTable.columns.push(`${columnName} : ${columnType}`);
            }
          }
          
          // Exit columns section if we encounter a line at table level or higher
          else if (indentLevel <= tableIndentLevel && trimmedLine !== '') {
            inColumnsSection = false;
          }
        }
      }

      // Add the last table
      if (currentTable) {
        tables.push(currentTable);
      }

      console.log('Parsed tables from DSL:', tables);
      setParsedTables(tables);
    } catch (error) {
      console.error('Error parsing DSL content:', error);
      setParsedTables([]);
    }
  };

  // Fetch data from API - now exposed as a function to be called on demand
  const fetchLineageData = async () => {
    if (!dslContent || !dslContent.trim()) {
      setLineage(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching lineage data from API...');
      const response = await generateArtifacts(dslContent);
      
      console.log('API Response:', response);
      
      // The API returns: { csv, mermaids, lineage, referentialWarnings }
      if (response.lineage) {
        setLineage(response.lineage);
        console.log('Lineage data loaded from API:', response.lineage);
      } else {
        console.warn('No lineage data returned from API');
        setLineage(null);
      }
      
    } catch (err: any) {
      console.error('Error fetching from API:', err);
      setError(err.message || 'Failed to fetch lineage data');
      setLineage(null);
    } finally {
      setLoading(false);
    }
  };

  // Only parse DSL content when it changes (no automatic API call)
  useEffect(() => {
    if (dslContent) {
      parseDSLContent(dslContent);
    } else {
      setParsedTables([]);
      setLineage(null);
      setError(null);
    }
  }, [dslContent]);

  return {
    parsedTables,
    lineage,
    loading,
    error,
    fetchLineageData // Expose this function to be called on demand
  };
};
