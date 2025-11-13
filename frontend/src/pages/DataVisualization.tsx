// src/pages/DataVisualization.tsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import YAML from "js-yaml";
import NavigationHeader from "@/components/NavigationHeader";
import SidebarNavigation, { defaultTabs } from "@/components/SidebarNavigation";
import ContentHeader from "@/components/ContentHeader";
import { ERDiagramView, LineageView, MappingsView } from "@/components/views";
import { Button } from "@/components/ui/button";
import { useDSLParser } from "../hooks/useDSLParser"; // adjust path if needed

/* ---------------------------
   Types
   --------------------------- */
interface ParsedTable {
  name: string;
  columns: string[];
}

type ColumnModel = {
  name: string;
  type: string;
  nullable: boolean;
  key: "PRI" | "UNI" | "MUL" | "-";
  default?: string | null;
  extra?: string | null;
  description?: string | null;
};

type TableModel = {
  name: string;
  description?: string | null;
  columns: ColumnModel[];
};

type Relationship = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: "many-to-one" | "one-to-many" | "one-to-one" | string;
};

/* ---------------------------
   Page component
   --------------------------- */
const DataVisualization: React.FC = () => {
  const location = useLocation();
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [activeTab, setActiveTab] = useState<string>("er-diagram");

  const projectData = {
    projectName: location.state?.projectName || "Untitled Project",
    engine: location.state?.engine || "Unknown Engine",
    tables: location.state?.tables || [],
    dslContent: location.state?.dslContent || "",
    generatedSchema: location.state?.generatedSchema || null,
  };

  // Prefer real hook if present; otherwise your hook file should implement fallback behaviour
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = (window as any).__USE_REAL_PARSER__ ? (useDSLParser as any)(projectData.dslContent) : (useDSLParser as any)(projectData.dslContent);

  const parsedTables: ParsedTable[] = parser.parsedTables || [];
  const lineage = parser.lineage;
  const loading = parser.loading;
  const error = parser.error;
  const fetchLineageData = parser.fetchLineageData;

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "lineage" && !lineage && !loading) {
      fetchLineageData();
    }
  };

  const tableCount = parsedTables.length > 0 ? parsedTables.length : (projectData.tables || []).length;

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader projectName={projectData.projectName} />

      <div className="flex h-[calc(100vh-4rem)]">
        <SidebarNavigation
          tabs={defaultTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        <div className="flex-1 flex flex-col">
          <ContentHeader
            tabs={defaultTabs}
            activeTab={activeTab}
            tableCount={tableCount}
          />
          <div className="flex-1 p-6">
            {activeTab === "schema" && (
              <SchemaView
                dslContent={projectData.dslContent}
              />
            )}
            {activeTab === "er-diagram" && <ERDiagramView parsedTables={parsedTables} />}
            {activeTab === "lineage" && (
              <LineageView
                lineage={lineage}
                lineageLevel={lineageLevel}
                onLevelChange={setLineageLevel}
                loading={loading}
                error={error}
                onRefresh={fetchLineageData}
              />
            )}
            {activeTab === "mappings" && <MappingsView />}
            {/* default fallback */}
            {!["schema", "er-diagram", "lineage", "mappings"].includes(activeTab) && (
              <ERDiagramView parsedTables={parsedTables} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;

/* ----------------------------
   SchemaView component + helpers
   ---------------------------- */

/* Helpers */
const asString = (v: any) => (v === undefined || v === null ? null : String(v));

function normalizeColumn(raw: any): ColumnModel {
  // fallback column typed as ColumnModel
  const fallback: ColumnModel = {
    name: "unknown",
    type: "TEXT",
    nullable: true,
    key: "-",
    default: null,
    extra: null,
    description: null,
  };

  if (typeof raw === "string") {
    return { ...fallback, name: raw };
  }

  const name = raw.name || raw.column || "unknown";
  const type = (raw.type || raw.data_type || "TEXT").toString();
  // DSL truthy not_null => NOT NULL => nullable = false
  const nullable = !(raw.not_null || raw.notNull || raw.required);
  const isPk = !!(raw.pk || raw.primary || raw.primary_key);
  const isUnique = !!raw.unique;

  // ensure key is narrowed to ColumnModel['key']
  const key: ColumnModel["key"] = isPk ? "PRI" : isUnique ? "UNI" : "-";

  const def = raw.default !== undefined && raw.default !== null ? String(raw.default) : null;

  // extra detection; produce string or null
  let extra: string | null = null;
  if (raw.extra) extra = String(raw.extra);
  else if (raw.auto_increment || raw.autoIncrement) extra = "auto_increment";
  else if (raw.rule && typeof raw.rule === "string" && raw.rule.startsWith("sequence(")) extra = `sequence:${String(raw.rule)}`;

  const description = asString(raw.description) || null;

  const out: ColumnModel = {
    name,
    type,
    nullable,
    key,
    default: def,
    extra,
    description,
  };

  return out;
}

function parseTablesFromDSL(dsl: string): TableModel[] {
  if (!dsl) return [];

  let doc: any;
  try {
    doc = YAML.load(dsl);
  } catch (err: any) {
    return [];
  }

  const tables: TableModel[] = [];

  if (Array.isArray(doc?.targets)) {
    doc.targets.forEach((t: any) => {
      const schemaTables = Array.isArray(t.tables) ? t.tables : [];
      schemaTables.forEach((tbl: any) => {
        const tblName = tbl.name || tbl.table || "unknown";
        const description = asString(tbl.description) || null;
        const rawColumns = Array.isArray(tbl.columns) ? tbl.columns : [];
        const columns: ColumnModel[] = rawColumns.map((c: any) => normalizeColumn(c));
        tables.push({ name: tblName, description, columns });
      });
    });
  } else {
    // fallback: crude regex parse (best-effort)
    const tablesMatch = String(dsl).match(/tables:\s*\n([\s\S]*?)(?=\n(?:sources:|mappings:|notes:|targets:|$))/);
    if (tablesMatch) {
      const block = tablesMatch[1];
      const parts = block.split(/\n(?=-\s*name:)/).map(s => s.trim()).filter(Boolean);
      parts.forEach((part) => {
        const nm = part.match(/- *name:\s*([^\n]+)/)?.[1]?.trim() || "unknown";
        const desc = part.match(/description:\s*([^\n]+)/)?.[1]?.trim() || null;
        // attempt extract column objects in `{ ... }` shape
        const colMatches = Array.from(part.matchAll(/\{([^}]+)\}/g)).map(m => `{${m[1]}}`);
        const cols: ColumnModel[] = colMatches.map((txt) => {
          try {
            const js = txt.replace(/([a-zA-Z0-9_]+)\s*:/g, (_, k) => `"${k}":`).replace(/'/g, '"');
            const parsed = JSON.parse(js);
            return normalizeColumn(parsed);
          } catch {
            return {
              name: "unknown",
              type: "TEXT",
              nullable: true,
              key: "-",
              default: null,
              extra: null,
              description: null,
            } as ColumnModel;
          }
        });
        tables.push({ name: nm, description: desc, columns: cols });
      });
    }
  }

  return tables;
}

function inferRelationshipsFromTables(tables: TableModel[]): Relationship[] {
  const rels: Relationship[] = [];
  const tableNames = tables.map(t => t.name);
  const lcToTable = new Map(tableNames.map(n => [n.toLowerCase(), n]));

  const tryMatchTable = (candidate: string | null | undefined) => {
    if (!candidate) return null;
    const lc = candidate.toLowerCase();
    if (lcToTable.has(lc)) return lcToTable.get(lc) as string;
    if (lc.endsWith("s") && lcToTable.has(lc.slice(0, -1))) return lcToTable.get(lc.slice(0, -1)) as string;
    if (!lc.endsWith("s") && lcToTable.has(lc + "s")) return lcToTable.get(lc + "s") as string;
    return null;
  };

  tables.forEach((tbl) => {
    tbl.columns.forEach((col) => {
      const explicitRefMatch =
        (col.description && col.description.match(/references\s+([\w.]+)(?:\(([\w]+)\))?/i)) ||
        (col.extra && String(col.extra).match(/references\s+([\w.]+)(?:\(([\w]+)\))?/i));

      if (explicitRefMatch) {
        const target = explicitRefMatch[1];
        const targetCol = explicitRefMatch[2] || "id";
        const matchedTable = tryMatchTable(target);
        if (matchedTable) {
          rels.push({
            fromTable: tbl.name,
            fromColumn: col.name,
            toTable: matchedTable,
            toColumn: targetCol,
            type: "many-to-one",
          });
          return;
        }
      }

      if (col.name && col.name.toLowerCase().endsWith("_id")) {
        const prefix = col.name.slice(0, -3);
        const matchedTable = tryMatchTable(prefix);
        if (matchedTable && matchedTable !== tbl.name) {
          rels.push({
            fromTable: tbl.name,
            fromColumn: col.name,
            toTable: matchedTable,
            toColumn: "id",
            type: "many-to-one",
          });
        }
      }
    });
  });

  const uniq = new Map<string, Relationship>();
  rels.forEach(r => {
    const k = `${r.fromTable}::${r.fromColumn}::${r.toTable}::${r.toColumn}`;
    if (!uniq.has(k)) uniq.set(k, r);
  });

  return Array.from(uniq.values());
}

const renderAllAsText = (tbs: TableModel[], rels: Relationship[]) => {
  const parts: string[] = [];
  tbs.forEach((t) => {
    parts.push(`Table: ${t.name}`);
    if (t.description) parts.push(`${t.description}\n`);
    parts.push("");
    parts.push("Column Name\tData Type\tNullable\tKey\tDefault\tExtra\tDescription");
    t.columns.forEach((c) => {
      parts.push(
        `${c.name}\t${c.type}\t${c.nullable ? "YES" : "NO"}\t${c.key}\t${c.default ?? "NULL"}\t${c.extra ?? "-"}\t${c.description ?? "-"}`
      );
    });
    parts.push("\n");
  });

  if (rels.length > 0) {
    parts.push("Table Relationships");
    parts.push("From Table\tFrom Column\tTo Table\tTo Column\tRelationship Type");
    rels.forEach((r) => {
      parts.push(`${r.fromTable}\t${r.fromColumn}\t${r.toTable}\t${r.toColumn}\t${r.type}`);
    });
  }

  return parts.join("\n");
};

/* ----------------------------
   SchemaView component implementation
   ---------------------------- */
interface SchemaViewProps {
  dslContent: string;
  generatedSchema?: string | null;
}

export const SchemaView: React.FC<SchemaViewProps> = ({ dslContent }) => {
  const [tables, setTables] = useState<TableModel[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const parsed = parseTablesFromDSL(dslContent || "");
      setTables(parsed);
      const rels = inferRelationshipsFromTables(parsed);
      setRelationships(rels);
      setError(null);
    } catch (err: any) {
      setError(String(err?.message || err));
      setTables([]);
      setRelationships([]);
    }
  }, [dslContent]);

  const copyAll = async () => {
    const text = renderAllAsText(tables, relationships);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadTxt = () => {
    const text = renderAllAsText(tables, relationships);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema_human_readable.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full p-6">
      <div className="bg-card border border-border rounded-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Schema</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={copyAll} disabled={tables.length === 0}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={downloadTxt} disabled={tables.length === 0}>Download</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="text-red-600">Error: {error}</div>
          ) : tables.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 p-6">
              <div className="text-center">
                <h4 className="text-lg font-medium">No schema available</h4>
                <p className="text-sm">Upload/paste DSL on the project page and generate schema first.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {tables.map((t) => (
                <div key={t.name} className="bg-background/50 border border-border rounded p-4">
                  <h4 className="text-lg font-semibold mb-1">Table: {t.name}</h4>
                  {t.description && <div className="text-sm text-muted-foreground mb-3">{t.description}</div>}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-auto border-collapse">
                      <thead>
                        <tr className="bg-muted/10">
                          <th className="text-left p-2 border-b">Column Name</th>
                          <th className="text-left p-2 border-b">Data Type</th>
                          <th className="text-left p-2 border-b">Nullable</th>
                          <th className="text-left p-2 border-b">Key</th>
                          <th className="text-left p-2 border-b">Default</th>
                          <th className="text-left p-2 border-b">Extra</th>
                          <th className="text-left p-2 border-b">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.columns.map((c) => (
                          <tr key={`${t.name}-${c.name}`} className="even:bg-muted/5">
                            <td className="p-2 align-top font-mono">{c.name}</td>
                            <td className="p-2 align-top">{c.type}</td>
                            <td className="p-2 align-top">{c.nullable ? "YES" : "NO"}</td>
                            <td className="p-2 align-top">{c.key}</td>
                            <td className="p-2 align-top">{c.default ?? "NULL"}</td>
                            <td className="p-2 align-top">{c.extra ?? "-"}</td>
                            <td className="p-2 align-top">{c.description ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Relationships */}
              <div>
                <h4 className="text-lg font-semibold mb-2">Table Relationships</h4>
                {relationships.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No relationships inferred from DSL.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-auto border-collapse">
                      <thead>
                        <tr className="bg-muted/10">
                          <th className="text-left p-2 border-b">From Table</th>
                          <th className="text-left p-2 border-b">From Column</th>
                          <th className="text-left p-2 border-b">To Table</th>
                          <th className="text-left p-2 border-b">To Column</th>
                          <th className="text-left p-2 border-b">Relationship Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relationships.map((r, idx) => (
                          <tr key={`${r.fromTable}-${r.fromColumn}-${idx}`} className="even:bg-muted/5">
                            <td className="p-2">{r.fromTable}</td>
                            <td className="p-2 font-mono">{r.fromColumn}</td>
                            <td className="p-2">{r.toTable}</td>
                            <td className="p-2 font-mono">{r.toColumn}</td>
                            <td className="p-2">{r.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
