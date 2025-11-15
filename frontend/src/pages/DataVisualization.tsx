// src/pages/DataVisualization.tsx - KEY CHANGE: Fixed lineage container height
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LineageGraph from "@/components/LineageGraph";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthProvider";
import {
  ArrowLeft,
  Database,
  Share2,
  GitBranch,
  Map,
  FileText,
  Table,
  LogOut,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useLocation } from "react-router-dom";
import mermaid from "mermaid";

type LineageShape = {
  nodes?: any[];
  edges?: any[];
  table_edges?: any[];
  tables?: any[];
  relations?: any[];
  [k: string]: any;
};

const DataVisualization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const dslContent = (location.state as any)?.dslContent || "";
  const projectName = (location.state as any)?.projectName || "Untitled Project";
  const uploadedFileName = (location.state as any)?.uploadedFileName || "";

  const [activeTab, setActiveTab] = useState("schema");
  const [parsedTables, setParsedTables] = useState<any[]>([]);
  const [lineage, setLineage] = useState<LineageShape | null>(null);
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [mermaids, setMermaids] = useState<Array<{ name: string; content: string }>>([]);
  const [csvText, setCsvText] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // schema UI state
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const erdContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    } catch (e) {
      // ignore init errors
    }
  }, []);

  const escapeHtml = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // --- parse DSL into parsedTables (light parser) ---
  useEffect(() => {
    if (!dslContent || !dslContent.trim()) {
      setParsedTables([]);
      return;
    }
    try {
      const lines = dslContent.split("\n");
      const tables: any[] = [];
      let inTargets = false;
      let inTables = false;
      let currentTable: any = null;
      let inColumns = false;
      let tableIndent = 0;

      const stripQuotes = (s: string) => (s ? s.replace(/^["']|["']$/g, "") : "");

      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        const indent = raw.length - raw.trimStart().length;

        if (trimmed === "targets:") {
          inTargets = true;
          inTables = false;
          inColumns = false;
          continue;
        }
        if (inTargets && trimmed === "tables:") {
          inTables = true;
          inColumns = false;
          continue;
        }
        if (!inTargets || !inTables) continue;

        // Table start
        if (trimmed.startsWith("- name:") && indent <= 8) {
          if (currentTable) tables.push(currentTable);
          const m = trimmed.match(/- name:\s*(.+)/);
          currentTable = { name: m ? stripQuotes(m[1].trim()) : "unknown", columns: [], description: "" };
          tableIndent = indent;
          inColumns = false;
          continue;
        }

        // columns block start
        if (currentTable && trimmed === "columns:" && indent > tableIndent) {
          inColumns = true;
          continue;
        }

        // Inline map like: - { name: user_id, type: INTEGER, pk: true, description: Surrogate key }
        if (currentTable && inColumns && trimmed.startsWith("- {") && trimmed.includes("}")) {
          const inside = trimmed.replace(/^- \{/, "").replace(/\}$/, "");
          const props: Record<string, string> = {};
          const kvRe = /([A-Za-z0-9_]+)\s*:\s*(".*?"|'.*?'|[^,}]+)/g;
          let m;
          while ((m = kvRe.exec(inside)) !== null) {
            props[m[1].trim()] = stripQuotes((m[2] || "").trim());
          }

          const colName = props["name"] || props["column"] || "unknown";
          const colType = props["type"] || props["datatype"] || props["data_type"] || "";
          const isPk = ["true", "1"].includes(String(props["pk"] || props["primary"] || props["is_primary"] || props["primary_key"] || "").toLowerCase())
            || (props["key"] && /pri|primary|pk/i.test(String(props["key"])));
          const key = isPk ? "PRI" : (props["key"] ? String(props["key"]) : "-");
          const description = props["description"] || props["desc"] || props["comment"] || "";

          currentTable.columns.push({
            name: colName,
            type: colType,
            description,
            key,
          });
          continue;
        }

        // Block style column: - name: email  then nested lines for type/description/pk etc.
        if (currentTable && inColumns && trimmed.startsWith("- name:")) {
          const nm = trimmed.match(/- name:\s*(.+)/);
          const colName = nm ? stripQuotes(nm[1].trim()) : "unknown";
          let colType = "";
          let colDesc = "";
          let explicitKey = "";
          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            const t2 = line.trim();
            const indent2 = line.length - line.trimStart().length;
            if (t2.startsWith("- name:") || t2 === "" || indent2 <= tableIndent) break;

            const mType = t2.match(/type:\s*(.+)/);
            if (mType) colType = stripQuotes(mType[1].trim());

            const d2 = t2.match(/description:\s*(.+)/);
            if (d2) colDesc = stripQuotes(d2[1].trim());

            const d21 = t2.match(/desc:\s*(.+)/);
            if (d21 && !colDesc) colDesc = stripQuotes(d21[1].trim());

            const pkMatch = t2.match(/(pk|primary_key|primary|is_primary|primaryKey|key):\s*(.+)/i);
            if (pkMatch) {
              const val = pkMatch[2].trim().replace(/^"|'|,|}$/g, "");
              if (val && /true|1|pri|primary|pk/i.test(String(val))) explicitKey = "PRI";
              else explicitKey = val;
            }

            const colKey = t2.match(/column_key:\s*(.+)/i);
            if (colKey && !explicitKey) {
              const v = stripQuotes(colKey[1].trim());
              explicitKey = /pri/i.test(v) ? "PRI" : v;
            }
          }

          currentTable.columns.push({
            name: colName,
            type: colType,
            description: colDesc,
            key: explicitKey || (colName === "id" ? "PRI" : "-"),
          });
          continue;
        }

        if (currentTable && indent === tableIndent && trimmed.startsWith("description:")) {
          const d = trimmed.match(/description:\s*(.+)/);
          if (d) currentTable.description = stripQuotes(d[1].trim());
        }
      }

      if (currentTable) tables.push(currentTable);
      setParsedTables(tables);
      if (!selectedTable && tables.length > 0) setSelectedTable(tables[0].name);
    } catch (e) {
      console.error("parseDSL failed", e);
      setParsedTables([]);
    }
  }, [dslContent]);

  // normalize lineage (ensure nodes exist)
  const normalizeLineage = (raw: LineageShape | null): LineageShape | null => {
    if (!raw) return null;
    const nodes = Array.isArray(raw.nodes) ? [...raw.nodes] : [];
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const ensureNode = (id: string, kind?: string, label?: string) => {
      if (!id) return;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({ id, type: kind || "unknown", label: label || id, meta: {} });
      }
    };

    const edges = Array.isArray(raw.edges) ? [...raw.edges] : [];
    for (const e of edges) {
      if (!e || !e.source || !e.target) continue;
      ensureNode(e.source);
      ensureNode(e.target);
    }

    const table_edges = Array.isArray(raw.table_edges) ? [...raw.table_edges] : [];
    for (const te of table_edges) {
      if (!te || !te.source || !te.target) continue;
      ensureNode(te.source);
      ensureNode(te.target);
    }

    return { ...raw, nodes, edges, table_edges };
  };

  // fetch artifacts from backend /api/generate
  useEffect(() => {
    if (!dslContent || !dslContent.trim()) return;
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setErrorMsg(null);
      setMermaids([]);
      setCsvText(null);
      setLineage(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "text/yaml; charset=utf-8" },
          body: dslContent,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          const msg = (errBody && (errBody.error || JSON.stringify(errBody))) || `Server returned ${res.status}`;
          throw new Error(msg);
        }

        const body = await res.json();

        if (mounted) {
          setCsvText(body.csv || null);
          setMermaids(Array.isArray(body.mermaids) ? body.mermaids : []);
          const normalized = normalizeLineage(body.lineage || null);
          setLineage(normalized);
          if (!selectedTable && normalized && Array.isArray(normalized.tables) && normalized.tables.length > 0) {
            setSelectedTable(String(normalized.tables[0].name || normalized.tables[0].id));
          }
        }
      } catch (err: any) {
        console.error("generate failed", err);
        if (mounted) setErrorMsg(err?.message ? String(err.message) : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [dslContent]);

  // find table info (prefer lineage then parsed)
  const findTable = (name: string | null) => {
    if (!name) return null;

    const normalizeCol = (c: any) => {
      const colName = c?.name || c?.column || c?.field || c?.col || String(c || "");
      const type = c?.type || c?.data_type || c?.sql_type || c?.datatype || "-";

      const explicitKeyCandidates = [
        c?.key, c?.key_type, c?.keyName, c?.key_name, c?.constraint,
        c?.indexType, c?.index_name, c?.keyType, c?.constraint_name,
        c?.column_key, c?.index, c?.role, c?.pk, c?.primary_key,
        c?.primary || c?.is_primary, c?.isPrimary, c?.is_pk,
        c?.primaryKey, c?.meta?.primary, c?.meta?.is_primary,
      ];

      let explicitKey: any = null;
      for (const cand of explicitKeyCandidates) {
        if (cand === true) { explicitKey = "PRI"; break; }
        if (typeof cand === "string" && cand.trim()) {
          const low = cand.toLowerCase();
          if (low.includes("pri") || low.includes("primary") || low.includes("pk")) {
            explicitKey = "PRI";
            break;
          } else {
            explicitKey = cand;
          }
        }
      }

      if (!explicitKey && Array.isArray(c?.constraints)) {
        const hasPri = c.constraints.some((x: any) => {
          const s = (typeof x === "string" ? x : JSON.stringify(x)).toLowerCase();
          return s.includes("primary") || s.includes("pri") || s.includes("pk");
        });
        if (hasPri) explicitKey = "PRI";
      }

      if (!explicitKey && (c?.column_key || c?.Column_key)) {
        const ck = String(c.column_key || c.Column_key);
        if (ck.toLowerCase().includes("pri")) explicitKey = "PRI";
        else explicitKey = ck;
      }

      const isPrimaryExplicit = !!(c?.primary || c?.is_primary || c?.isPrimary || c?.pk || c?.primaryKey);
      const inferredKey = isPrimaryExplicit ? "PRI" : (String(colName) === "id" ? "PRI" : "-");

      const key = explicitKey ? String(explicitKey) : inferredKey;

      const rawDesc = (c && (
        c.description || c.desc || c.comment || c.notes ||
        c.meta?.description || c.meta?.comment || c.note
      )) || "";
      const description = String(rawDesc).replace(/^["']|["']$/g, "");

      return {
        name: colName,
        type,
        key,
        description,
      };
    };

    if (lineage && Array.isArray(lineage.tables)) {
      const t = lineage.tables.find((x: any) => String(x.name || x.id || x.table || x.table_name) === name);
      if (t) {
        const cols = Array.isArray(t.columns) ? t.columns.map(normalizeCol) : [];
        const desc = t.description || t.meta?.description || t.comment || t.notes || "";
        return { name, description: desc, columns: cols };
      }
    }

    const p = parsedTables.find((x) => String(x.name) === name);
    if (p) {
      const cols = (p.columns || []).map((c: any) => {
        if (typeof c === "string") return { name: c, type: "-", key: (c === "id" ? "PRI" : "-"), description: "" };
        return {
          name: c.name || c.column || "",
          type: c.type || "-",
          key: c.key || (c.name === "id" ? "PRI" : "-"),
          description: c.description || c.desc || "",
        };
      });
      return { name: p.name, description: p.description || "", columns: cols };
    }
    return null;
  };

  useEffect(() => {
    if (!selectedTable) {
      if (lineage && Array.isArray(lineage.tables) && lineage.tables.length > 0) {
        setSelectedTable(String(lineage.tables[0].name || lineage.tables[0].id));
      } else if (parsedTables.length > 0) {
        setSelectedTable(parsedTables[0].name);
      }
    } else {
      const existsInParsed = parsedTables.some((t) => String(t.name) === selectedTable);
      const existsInLineage = lineage && Array.isArray(lineage.tables) && lineage.tables.some((t: any) => String(t.name || t.id || t.table || t.table_name) === selectedTable);
      if (!existsInParsed && !existsInLineage) {
        if (lineage && Array.isArray(lineage.tables) && lineage.tables.length > 0) {
          setSelectedTable(String(lineage.tables[0].name || lineage.tables[0].id));
        } else if (parsedTables.length > 0) {
          setSelectedTable(parsedTables[0].name);
        } else {
          setSelectedTable(null);
        }
      }
    }
  }, [parsedTables, lineage, selectedTable]);

  // MERMAID render for ER tab
  useEffect(() => {
    if (activeTab !== "er-diagram") return;
    const container = erdContainerRef.current;
    if (!container) return;

    const pickMermaid = (preferType = "erDiagram") => {
      if (!mermaids || mermaids.length === 0) return null;
      const byName = mermaids.find((m) =>
        preferType === "erDiagram"
          ? m.name && m.name.toLowerCase().startsWith("erd_")
          : m.name && m.name.toLowerCase().startsWith("class_")
      );
      if (byName && byName.content) return byName.content;
      const contentMatch = mermaids.find((m) =>
        typeof m.content === "string" && new RegExp(`(^|\\n)\\s*${preferType}\\b`, "i").test(m.content)
      );
      if (contentMatch && contentMatch.content) return contentMatch.content;
      return mermaids[0].content || null;
    };

    const erMermaid = pickMermaid("erDiagram");
    const classMermaid = (() => {
      if (!mermaids || mermaids.length === 0) return null;
      const byName = mermaids.find((m) => m.name && m.name.toLowerCase().startsWith("class_"));
      if (byName) return byName.content;
      const byContent = mermaids.find((m) => typeof m.content === "string" && /(^|\n)\s*classDiagram\b/i.test(m.content));
      if (byContent) return byContent.content;
      return null;
    })();

    const escapeAndShow = (text: string, errMsg?: string) => {
      container.innerHTML =
        `<pre>${escapeHtml(text)}</pre>` + (errMsg ? `<div class="text-sm text-red-600 mt-2">Mermaid render error: ${escapeHtml(errMsg)}</div>` : "");
    };

    const tryRender = async (content: string | null) => {
      if (!content) return false;
      try {
        if ((mermaid as any).parse && typeof (mermaid as any).parse === "function") {
          (mermaid as any).parse(content);
        }
        if (typeof (mermaid as any).render === "function") {
          const r = (mermaid as any).render(`mermaid_${Date.now()}`, content);
          if (r && typeof r.then === "function") {
            const resolved = await r;
            const svg = typeof resolved === "string" ? resolved : resolved?.svg || resolved?.rendered || "";
            if (!svg) throw new Error("Mermaid.render returned no svg");
            container.innerHTML = svg;
            return true;
          } else if (typeof r === "string") {
            container.innerHTML = r;
            return true;
          }
        }
        if ((mermaid as any).mermaidAPI && typeof (mermaid as any).mermaidAPI.render === "function") {
          const apiRes = await (mermaid as any).mermaidAPI.render(`mermaid_${Date.now()}`, content);
          const svg = apiRes && (apiRes.svg || apiRes?.rendered || "");
          if (!svg) throw new Error("mermaidAPI.render returned no svg");
          container.innerHTML = svg;
          return true;
        }
        escapeAndShow(content, "No mermaid renderer available");
        return false;
      } catch (err: any) {
        throw err;
      }
    };

    (async () => {
      container.innerHTML = "";
      try {
        if (erMermaid) { await tryRender(erMermaid); return; }
      } catch (err: any) {
        console.warn("erDiagram render failed:", err && (err.message || err.toString ? err.toString() : err));
      }
      try {
        if (classMermaid) { await tryRender(classMermaid); return; }
      } catch (err: any) {
        console.warn("classDiagram render failed:", err && (err.message || err.toString ? err.toString() : err));
      }
      const raw = erMermaid || (mermaids && mermaids[0] && mermaids[0].content) || "";
      const errMsg = "Both erDiagram and classDiagram failed to render; showing raw mermaid for debugging.";
      escapeAndShow(raw, errMsg);
    })();

    return () => {
      try { if (container) container.innerHTML = ""; } catch (e) {}
    };
  }, [mermaids, activeTab]);

  const csvTable = useMemo(() => {
    if (!csvText) return null;
    const rows = csvText.split(/\r?\n/).filter((r) => r.trim() !== "");
    if (rows.length === 0) return null;
    const headers = rows[0].split(",");
    const body = rows.slice(1).map((r) => {
      const cols = r.split(",");
      return cols;
    });
    return { headers, body };
  }, [csvText]);

  const tabs = [
    { id: "schema", label: "Schema", Icon: FileText },
    { id: "er-diagram", label: "ER Diagram", Icon: Share2 },
    { id: "lineage", label: "Lineage", Icon: GitBranch },
    { id: "mappings", label: "Mappings", Icon: Map },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative h-16 flex items-center">
          <div className="absolute left-10 top-1/2 -translate-y-1/2 z-30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate("/create-project", {
                  state: { projectName, dslContent, uploadedFileName },
                })
              }
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Project</span>
            </Button>
          </div>

          <div className="absolute right-10 top-1/2 -translate-y-1/2 z-30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                  <Avatar>
                    <AvatarFallback>VJ</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Vinit Jain</p>
                    <p className="text-xs leading-none text-muted-foreground">vinit.jain@example.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="container flex items-center justify-center w-full pl-[160px] pr-[160px]">
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="text-lg font-semibold truncate max-w-[60vw]">{projectName}</h1>
              <div className="text-sm text-muted-foreground">{uploadedFileName}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-64 border-r border-border bg-muted/30">
          <div className="p-4">
            <h2 className="font-medium text-sm text-muted-foreground mb-4">VIEWS</h2>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.Icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {Icon ? <Icon className="w-4 h-4 mr-3" /> : null}
                    {tab.label}
                  </Button>
                );
              })}
            </nav>

            <div className="mt-6 space-y-2 text-xs">
              {loading ? <div>Generating artifacts…</div> : null}
              {errorMsg ? <div className="text-red-600">{errorMsg}</div> : null}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tabs.find((t) => t.id === activeTab)?.label}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Database className="w-3 h-3 mr-1" />
                  {parsedTables.length > 0 ? parsedTables.length : 0} tables
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Schema View */}
            {activeTab === "schema" && (
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <h4 className="text-lg font-medium mb-3">Tables</h4>
                    <div className="space-y-2">
                      {((lineage && Array.isArray(lineage.tables) ? lineage.tables.map((t:any) => ({ name: String(t.name || t.id || t.table || t.table_name), desc: t.description || "" })) : parsedTables.map((t) => ({ name: String(t.name), desc: t.description || "" })))).map((t:any) => {
                        const name = t.name;
                        const active = name === selectedTable;
                        return (
                          <button
                            key={name}
                            onClick={() => setSelectedTable(name)}
                            className={`w-full text-left p-3 rounded border ${active ? "bg-primary/10 border-primary" : "bg-white border-border"} hover:shadow-sm`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold">{name}</div>
                                {t.desc ? <div className="text-xs text-muted-foreground">{t.desc}</div> : null}
                              </div>
                              <div className="text-xs text-muted-foreground ml-4">→</div>
                            </div>
                          </button>
                        );
                      })}
                      {(lineage && Array.isArray(lineage.tables) && lineage.tables.length === 0 && parsedTables.length === 0) && (
                        <div className="text-sm text-muted-foreground p-3">No tables found.</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    {selectedTable ? (
                      (() => {
                        const info = findTable(selectedTable);
                        if (!info) {
                          return <div className="p-6 bg-white border rounded">No details available for <strong>{selectedTable}</strong>.</div>;
                        }
                        return (
                          <div>
                            <h3 className="text-2xl font-semibold mb-1">Table: {info.name}</h3>
                            {info.description ? <div className="text-muted-foreground italic mb-4">{info.description}</div> : null}

                            <div className="bg-white rounded border overflow-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/20">
                                  <tr>
                                    <th className="text-left p-4 font-medium">Column Name</th>
                                    <th className="text-left p-4 font-medium">Data Type</th>
                                    <th className="text-left p-4 font-medium">Key</th>
                                    <th className="text-left p-4 font-medium">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(info.columns || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="p-4 text-muted-foreground">No columns metadata available.</td>
                                    </tr>
                                  ) : (
                                    (info.columns || []).map((c: any, idx: number) => {
                                      const name = c.name || String(c);
                                      const type = c.type || "-";
                                      const key = c.key || "-";
                                      const desc = c.description || "";
                                      return (
                                        <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/5"}>
                                          <td className="p-4 font-semibold">{name}</td>
                                          <td className="p-4">{type}</td>
                                          <td className="p-4">{key}</td>
                                          <td className="p-4">{desc}</td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-6 bg-white border rounded">Select a table to see details.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ER Diagram */}
            {activeTab === "er-diagram" && (
              <div className="p-6 h-full">
                <div className="h-full bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        if (mermaids && mermaids.length > 0) {
                          console.log("Mermaid content:", mermaids[0].content);
                          alert("Mermaid content logged to console for debugging.");
                        } else {
                          alert("No mermaid content available.");
                        }
                      }}>Debug</Button>
                    </div>
                  </div>

                  <div className="h-[calc(100%-3rem)] overflow-auto bg-white rounded p-4">
                    {mermaids && mermaids.length > 0 ? (
                      <div ref={erdContainerRef} id="erd-viz" className="w-full" />
                    ) : parsedTables.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parsedTables.map((t) => (
                          <Card key={`fallback-${t.name}`}>
                            <CardHeader>
                              <CardTitle>{t.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-1">
                                {(t.columns || []).map((c: any, idx: number) => (
                                  <div key={idx} className="text-xs font-mono">
                                    {c.name} : {c.type}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">No ERD available</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Lineage - FIXED HEIGHT */}
            {activeTab === "lineage" && (
              <div className="h-full p-6">
                <div className="h-full flex flex-col bg-card border border-border rounded-lg">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div />
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant={lineageLevel === "table" ? "secondary" : "outline"} 
                        onClick={() => setLineageLevel("table")}
                      >
                        Table-level
                      </Button>
                      <Button 
                        size="sm" 
                        variant={lineageLevel === "column" ? "secondary" : "outline"} 
                        onClick={() => setLineageLevel("column")}
                      >
                        Column-level
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0">
                    {lineage ? (
                      <LineageGraph lineage={lineage as any} level={lineageLevel} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground p-6">
                          <div className="text-4xl mb-4">🔄</div>
                          <p className="text-lg font-medium">No lineage available</p>
                          <p className="text-sm mt-2">Generate artifacts from DSL on the project page.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mappings */}
            {activeTab === "mappings" && (
              <div className="p-6 h-full">
                <div className="h-full bg-card border border-border rounded-lg">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div />
                    <div>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!csvText) return;
                        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "mapping_matrix.csv";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }} disabled={!csvText}>
                        Download CSV
                      </Button>
                    </div>
                  </div>

                  <div className="h-[calc(100%-4rem)] overflow-auto bg-white rounded-b p-4">
                    {csvTable ? (
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            {csvTable.headers.map((h, i) => (
                              <th key={i} className="text-left p-2 border-b">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvTable.body.map((r, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/10"}>
                              {r.map((c: any, ci: number) => (
                                <td key={ci} className="p-2 align-top">{c}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-muted-foreground p-6">No mapping CSV available.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;