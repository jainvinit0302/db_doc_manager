// src/pages/DataVisualization.tsx
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
  [k: string]: any;
};

const DataVisualization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const dslContent = (location.state as any)?.dslContent || "";
  const projectName = (location.state as any)?.projectName || "Untitled Project";
  const uploadedFileName = (location.state as any)?.uploadedFileName || "";

  const [activeTab, setActiveTab] = useState("er-diagram");
  const [parsedTables, setParsedTables] = useState<any[]>([]);
  const [lineage, setLineage] = useState<LineageShape | null>(null);
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [mermaids, setMermaids] = useState<Array<{ name: string; content: string }>>([]);
  const [csvText, setCsvText] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const erdContainerRef = useRef<HTMLDivElement | null>(null);
  const mermaidRenderedIdRef = useRef<string | null>(null);

  // initialize mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    } catch (e) {
      // ignore initialization errors (mermaid already initialized in HMR/dev)
    }
  }, []);

  // helper to escape HTML for fallback display
  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Simple DSL parsing to show local table cards (keeps previous parsing behaviour)
  useEffect(() => {
    if (!dslContent || !dslContent.trim()) {
      setParsedTables([]);
      return;
    }
    // Lightweight parser (same approach as before) — extracts tables and columns for UI fallback
    try {
      const lines = dslContent.split("\n");
      const tables: any[] = [];
      let inTargets = false;
      let inTables = false;
      let currentTable: any = null;
      let inColumns = false;
      let tableIndent = 0;

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

        if (trimmed.startsWith("- name:") && indent <= 8) {
          if (currentTable) tables.push(currentTable);
          const m = trimmed.match(/- name:\s*(.+)/);
          currentTable = { name: m ? m[1].trim() : "unknown", columns: [] };
          tableIndent = indent;
          inColumns = false;
          continue;
        }

        if (currentTable && trimmed === "columns:" && indent > tableIndent) {
          inColumns = true;
          continue;
        }

        if (currentTable && inColumns) {
          // inline YAML map { name: x, type: Y }
          if (trimmed.startsWith("- {") && trimmed.includes("name:")) {
            const nameMatch = trimmed.match(/name:\s*([^,}]+)/);
            const typeMatch = trimmed.match(/type:\s*([^,}]+)/);
            if (nameMatch) {
              currentTable.columns.push({
                name: nameMatch[1].trim(),
                type: typeMatch ? typeMatch[1].trim() : "unknown",
              });
            }
            continue;
          }
          if (trimmed.startsWith("- name:")) {
            const nm = trimmed.match(/- name:\s*(.+)/);
            const colName = nm ? nm[1].trim() : "unknown";
            // look ahead for type
            let colType = "unknown";
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
              const t2 = lines[j].trim();
              const m2 = t2.match(/type:\s*(.+)/);
              if (m2) {
                colType = m2[1].trim();
                break;
              }
              if (t2.startsWith("- name:") || t2 === "" || (lines[j].length - lines[j].trimStart().length) <= tableIndent) break;
            }
            currentTable.columns.push({ name: colName, type: colType });
            continue;
          }
        }
      }
      if (currentTable) tables.push(currentTable);
      setParsedTables(tables);
    } catch (e) {
      console.error("parseDSL failed", e);
      setParsedTables([]);
    }
  }, [dslContent]);

  // normalize lineage: ensure nodes exist for every edge source/target
  const normalizeLineage = (raw: LineageShape | null): LineageShape | null => {
    if (!raw) return null;
    const nodes = Array.isArray(raw.nodes) ? [...raw.nodes] : [];
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const ensureNode = (id: string, kind?: string, label?: string) => {
      if (!id) return;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          type: kind || "unknown",
          label: label || id,
          meta: {},
        });
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
    // only auto-generate if we have DSL content (navigated from CreateProject)
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

        // csv: may be empty string
        if (mounted) {
          setCsvText(body.csv || null);
          setMermaids(Array.isArray(body.mermaids) ? body.mermaids : []);
          // normalize lineage to ensure nodes exist before setting
          const normalized = normalizeLineage(body.lineage || null);
          setLineage(normalized);
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

  // ----------------------------
  // MERMAID: render ERD into SVG
  // Re-run when mermaids content changes OR when the ER tab becomes active
  // ----------------------------
  useEffect(() => {
    // only render when ER tab is active
    if (activeTab !== "er-diagram") return;

    const container = erdContainerRef.current;
    if (!container) return;

    // pick preferred mermaid content (erDiagram first, classDiagram fallback)
    const pickMermaid = (preferType = "erDiagram") => {
      if (!mermaids || mermaids.length === 0) return null;
      // 1) by filename (erd_ or class_)
      const byName = mermaids.find((m) =>
        preferType === "erDiagram"
          ? m.name && m.name.toLowerCase().startsWith("erd_")
          : m.name && m.name.toLowerCase().startsWith("class_")
      );
      if (byName && byName.content) return byName.content;
      // 2) by content keyword
      const contentMatch = mermaids.find((m) =>
        typeof m.content === "string" && new RegExp(`(^|\\n)\\s*${preferType}\\b`, "i").test(m.content)
      );
      if (contentMatch && contentMatch.content) return contentMatch.content;
      // 3) fallback
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
        // optional parse step for early friendly errors
        if ((mermaid as any).parse && typeof (mermaid as any).parse === "function") {
          try {
            (mermaid as any).parse(content);
          } catch (parseErr) {
            throw parseErr;
          }
        }

        // use mermaid.render if available
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

        // fallback to mermaidAPI.render
        if ((mermaid as any).mermaidAPI && typeof (mermaid as any).mermaidAPI.render === "function") {
          const apiRes = await (mermaid as any).mermaidAPI.render(`mermaid_${Date.now()}`, content);
          const svg = apiRes && (apiRes.svg || apiRes?.rendered || "");
          if (!svg) throw new Error("mermaidAPI.render returned no svg");
          container.innerHTML = svg;
          return true;
        }

        // last resort: show raw content
        escapeAndShow(content, "No mermaid renderer available");
        return false;
      } catch (err: any) {
        // rethrow to let caller try fallback
        throw err;
      }
    };

    (async () => {
      container.innerHTML = ""; // clear while rendering
      // 1) try erDiagram content
      try {
        if (erMermaid) {
          await tryRender(erMermaid);
          return;
        }
      } catch (err: any) {
        console.warn("erDiagram render failed:", err && (err.message || err.toString ? err.toString() : err));
      }

      // 2) try classDiagram fallback
      try {
        if (classMermaid) {
          await tryRender(classMermaid);
          return;
        }
      } catch (err: any) {
        console.warn("classDiagram render failed:", err && (err.message || err.toString ? err.toString() : err));
      }

      // 3) show raw fallback
      const raw = erMermaid || (mermaids && mermaids[0] && mermaids[0].content) || "";
      const errMsg = "Both erDiagram and classDiagram failed to render; showing raw mermaid for debugging.";
      escapeAndShow(raw, errMsg);
    })();

    // cleanup: remove rendered SVG when dependencies change/unmount to avoid stale IDs
    return () => {
      try {
        if (container) container.innerHTML = "";
      } catch (e) {
        // ignore
      }
    };
  }, [mermaids, activeTab]); // re-run when mermaids or active tab changes

  useEffect(() => {
  const container = erdContainerRef.current;
  if (!container) return;
  const svg = container.querySelector('svg');
  if (!svg) return;
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';
  svg.style.maxWidth = 'none';
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
}, [mermaids, activeTab]);

  // helper to download csv text
  const downloadCSV = () => {
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
  };

  // simple CSV -> table conversion for mapping view (first 200 rows safe)
  const csvTable = useMemo(() => {
    if (!csvText) return null;
    const rows = csvText.split(/\r?\n/).filter((r) => r.trim() !== "");
    if (rows.length === 0) return null;
    const headers = rows[0].split(",");
    const body = rows.slice(1).map((r) => {
      // naive split (we wrote csvEscape without commas within quotes in our generator)
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
          {/* Back Button */}
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

          {/* User Menu */}
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

          {/* Center */}
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
        {/* Sidebar */}
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
              <div>Tables: {parsedTables.length || 0}</div>
              <div>Mermaid ERD files: {mermaids.length}</div>
              <div>Mappings rows: {(csvText ? csvText.split(/\r?\n/).length - 1 : 0)}</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
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

          <div className="flex-1 p-6 overflow-auto">
            {/* Schema View */}
            {activeTab === "schema" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Schema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {parsedTables.map((t) => (
                    <Card key={t.name}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Table className="w-4 h-4" />
                          {t.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {(t.columns || []).map((c: any, i: number) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              <code className="font-mono text-xs">{c.name} : {c.type}</code>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ER Diagram */}
            {activeTab === "er-diagram" && (
              <div className="w-full h-full p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">Entity Relationship Diagram</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      // show raw mermaid text in alert or console for debugging
                      if (mermaids && mermaids.length > 0) {
                        console.log("Mermaid content:", mermaids[0].content);
                        alert("Mermaid content logged to console for debugging.");
                      } else {
                        alert("No mermaid content available.");
                      }
                    }}>Debug</Button>
                  </div>
                </div>

                <div className="flex-1 min-h-[60vh] overflow-auto bg-white rounded p-4">
                  {mermaids && mermaids.length > 0 ? (
                    <div ref={erdContainerRef} id="erd-viz" className="w-full"/>
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
            )}

            {/* Lineage */}
            {activeTab === "lineage" && (
              <div className="w-full h-full p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">Data Lineage</h3>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={lineageLevel === "table" ? "secondary" : "outline"} onClick={() => setLineageLevel("table")}>Table-level</Button>
                    <Button size="sm" variant={lineageLevel === "column" ? "secondary" : "outline"} onClick={() => setLineageLevel("column")}>Column-level</Button>
                  </div>
                </div>

                <div className="h-[520px] overflow-auto">
                  {lineage ? (
                    <LineageGraph lineage={lineage} level={lineageLevel} />
                  ) : (
                    <div className="text-muted-foreground p-6">No lineage available. Generate artifacts from DSL on the project page.</div>
                  )}
                </div>
              </div>
            )}

            {/* Mappings/CSV */}
            {activeTab === "mappings" && (
              <div className="w-full h-full p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">Mappings / CSV</h3>
                  <div>
                    <Button size="sm" variant="outline" onClick={downloadCSV} disabled={!csvText}>
                      Download CSV
                    </Button>
                  </div>
                </div>

                <div className="h-[520px] overflow-auto">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
