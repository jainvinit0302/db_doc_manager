// src/pages/Visualization.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Layers,
  Share2,
  Box,
  Move,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";

import LineageGraph from "@/components/LineageGraph";
import ERDGraph from "@/components/ERDGraph";

type TabKey = "schema" | "erd" | "lineage" | "mapping" | "sql";

const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 100;
const STORAGE_PREFIX = "visualization.tab.";

const tabList: { key: TabKey; label: string; Icon?: React.ComponentType<any> }[] = [
  { key: "schema", label: "Schema", Icon: Database },
  { key: "erd", label: "ERD", Icon: Layers },
  { key: "lineage", label: "Lineage graph", Icon: Share2 },
  { key: "mapping", label: "Mapping", Icon: Box },
  { key: "sql", label: "SQL", Icon: Database },
];

type ViewState = {
  zoom: number;
  offset: { x: number; y: number };
  isPanMode: boolean;
  // React Flow state could be persisted here too if needed, but keeping it simple for now
};

const defaultState = (): ViewState => ({
  zoom: DEFAULT_ZOOM,
  offset: { x: 0, y: 0 },
  isPanMode: false,
});

const loadState = (tab: TabKey): ViewState => {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${tab}`);
    return raw ? JSON.parse(raw) : defaultState();
  } catch {
    return defaultState();
  }
};

const saveState = (tab: TabKey, s: ViewState) => {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${tab}`, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const Visualization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>("schema");
  const [search, setSearch] = useState("");

  // Data state
  const dslContent = (location.state as any)?.dslContent || "";
  const projectName = (location.state as any)?.projectName || "Untitled Project";
  const projectId = (location.state as any)?.projectId || null;
  const isEditing = (location.state as any)?.isEditing || false;
  const parsedData = (location.state as any)?.parsedData || null;
  const [parsedTables, setParsedTables] = useState<any[]>([]);

  const [lineage, setLineage] = useState<any | null>(null);
  const [erdData, setErdData] = useState<any | null>(null);
  const [mermaids, setMermaids] = useState<Array<{ name: string; content: string }>>([]);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // per-tab states
  const [viewStates, setViewStates] = useState<Record<TabKey, ViewState>>(() => {
    return {
      schema: defaultState(),
      erd: loadState("erd"),
      lineage: loadState("lineage"),
      mapping: defaultState(),
      sql: defaultState(),
    };
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // Fetch data
  useEffect(() => {
    if (!dslContent || !dslContent.trim()) return;

    let mounted = true;
    const run = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "text/yaml; charset=utf-8" },
          body: dslContent,
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const body = await res.json();
        console.log('Visualization: API response body:', body);
        console.log('Visualization: ERD data:', body.erd);
        console.log('Visualization: ERD data keys:', body.erd ? Object.keys(body.erd) : 'null');
        if (mounted) {
          setCsvText(body.csv || null);
          setMermaids(Array.isArray(body.mermaids) ? body.mermaids : []);
          setLineage(body.lineage || null);
          setErdData(body.erd || null);
          setSqlText(body.sql || null);
          console.log('Visualization: Set ERD state with', body.erd ? Object.keys(body.erd).length : 0, 'tables');
        }
      } catch (err: any) {
        console.error("generate failed", err);
        if (mounted) setErrorMsg(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [dslContent]);

  // Parse tables for schema view
  useEffect(() => {
    if (!dslContent) return;
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
        if (trimmed === "targets:") { inTargets = true; inTables = false; inColumns = false; continue; }
        if (inTargets && trimmed === "tables:") { inTables = true; inColumns = false; continue; }
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
            let colType = "unknown";
            // simple lookahead
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
              const t2 = lines[j].trim();
              const m2 = t2.match(/type:\s*(.+)/);
              if (m2) {
                colType = m2[1].trim();
                break;
              }
              if (t2.startsWith("- name:") || t2 === "") break;
            }
            currentTable.columns.push({ name: colName, type: colType });
            continue;
          }
        }
      }
      if (currentTable) tables.push(currentTable);
      setParsedTables(tables);
    } catch (e) {
      setParsedTables([]);
    }
  }, [dslContent]);


  // helper to update only active tab's state
  const setActiveViewState = useCallback(
    (updater: (s: ViewState) => ViewState) => {
      setViewStates((prev) => {
        const next = { ...prev, [activeTab]: updater(prev[activeTab]) };
        // persist only erd/lineage
        if (activeTab === "erd" || activeTab === "lineage") saveState(activeTab, next[activeTab]);
        return next;
      });
    },
    [activeTab]
  );

  const zoomIn = useCallback(() => {
    if (activeTab !== "lineage") return; // ERD handles its own zoom
    setActiveViewState((s) => ({ ...s, zoom: Math.min(s.zoom + ZOOM_STEP, MAX_ZOOM) }));
  }, [activeTab, setActiveViewState]);

  const zoomOut = useCallback(() => {
    if (activeTab !== "lineage") return;
    setActiveViewState((s) => ({ ...s, zoom: Math.max(s.zoom - ZOOM_STEP, MIN_ZOOM) }));
  }, [activeTab, setActiveViewState]);

  const resetView = useCallback(() => {
    if (activeTab !== "lineage") return;
    setActiveViewState(() => defaultState());
  }, [activeTab, setActiveViewState]);

  const togglePanMode = useCallback(() => {
    if (activeTab !== "lineage") return;
    setActiveViewState((s) => ({ ...s, isPanMode: !s.isPanMode }));
  }, [activeTab, setActiveViewState]);

  // Wheel-to-zoom only for lineage and only when ctrl/meta is pressed
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // only zoom when ctrl/cmd pressed and active tab supports controls
      if (activeTab !== "lineage") return;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY > 0) zoomOut();
      else zoomIn();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomIn, zoomOut, activeTab]);

  // panning logic - only active when current tab's isPanMode === true
  const onMouseDown = (e: React.MouseEvent) => {
    // only for lineage when pan mode turned on
    if (activeTab !== "lineage") return;
    const current = viewStates[activeTab];
    if (!current.isPanMode) return;

    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const target = e.currentTarget as HTMLElement;
    target.style.userSelect = "none";
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !lastMouse.current) return;
    // only modify state for lineage
    if (activeTab !== "lineage") return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    setActiveViewState((s) => ({ ...s, offset: { x: s.offset.x + dx, y: s.offset.y + dy } }));
  };

  const onMouseUp = () => {
    const el = canvasRef.current as HTMLElement | null;
    if (isDragging.current && el) el.style.userSelect = "";
    isDragging.current = false;
    lastMouse.current = null;
  };

  // keyboard shortcuts: + / - / 0 for zoom, 1..4 for tabs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        if (activeTab === "lineage") zoomIn();
      } else if (e.key === "-") {
        if (activeTab === "lineage") zoomOut();
      } else if (e.key === "0") {
        if (activeTab === "lineage") resetView();
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) { // Updated for 5 tabs
        const idx = Number(e.key) - 1;
        setActiveTab(tabList[Math.min(idx, tabList.length - 1)].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, zoomIn, zoomOut, resetView]);

  const shouldShowControls = useMemo(() => activeTab === "lineage", [activeTab]);

  // Renderers
  const renderSchema = () => (
    <div className="w-full h-full p-6 overflow-auto">
      <h3 className="text-xl font-semibold mb-3">Schema</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parsedTables.map((t, i) => (
          <div key={i} className="bg-card border border-border rounded p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2"><Database className="w-4 h-4" /> {t.name}</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {t.columns.map((c: any, j: number) => (
                <div key={j} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="font-mono text-xs opacity-70">{c.type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderERD = () => {
    // React Flow handles its own zoom/pan, so we don't use the wrapper transform
    return (
      <div className="w-full h-full overflow-hidden relative">
        <ERDGraph
          data={erdData}
          className="w-full h-full"
          active={activeTab === "erd"}
        />
      </div>
    );
  };

  const renderLineage = () => {
    const s = viewStates.lineage;
    return (
      <div className="w-full h-full p-6 overflow-hidden relative">
        <h3 className="text-xl font-semibold mb-3 absolute top-6 left-6 z-10 bg-background/80 px-2 rounded">Lineage Graph</h3>
        <div
          style={{
            transform: `translate(${s.offset.x}px, ${s.offset.y}px) scale(${s.zoom / 100})`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
          }}
        >
          <LineageGraph lineage={lineage} level="table" className="w-full h-full" />
        </div>
      </div>
    );
  };

  const renderSQL = () => {
    return (
      <div className="w-full h-full p-6 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Generated SQL (DDL)</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sqlText) {
                  navigator.clipboard.writeText(sqlText);
                  alert("SQL copied to clipboard!");
                }
              }}
              disabled={!sqlText}
            >
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sqlText) {
                  const blob = new Blob([sqlText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "schema.sql";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }}
              disabled={!sqlText}
            >
              Download .sql
            </Button>
          </div>
        </div>
        <div className="bg-muted/30 border border-border rounded-lg p-4 overflow-auto font-mono text-sm whitespace-pre">
          {sqlText || <span className="text-muted-foreground">No SQL generated.</span>}
        </div>
      </div>
    );
  };

  const renderMapping = () => {
    const rows = csvText ? csvText.split(/\r?\n/).filter(r => r.trim()) : [];
    const headers = rows.length > 0 ? rows[0].split(',') : [];
    const body = rows.slice(1).map(r => r.split(','));

    return (
      <div className="w-full h-full p-6 overflow-auto">
        <h3 className="text-xl font-semibold mb-3">Mappings</h3>
        <div className="bg-card border border-border rounded-lg overflow-auto">
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((h, i) => <th key={i} className="p-2 text-left font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {body.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {row.map((c, j) => <td key={j} className="p-2">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-muted-foreground">No mappings generated.</div>
          )}
        </div>
      </div>
    )
  };

  // Render all tabs but hide inactive ones to prevent unmounting
  const renderAllTabs = () => {
    return (
      <>
        <div style={{ display: activeTab === "schema" ? "block" : "none" }} className="w-full h-full">
          {renderSchema()}
        </div>
        <div style={{ display: activeTab === "erd" ? "block" : "none" }} className="w-full h-full">
          {renderERD()}
        </div>
        <div style={{ display: activeTab === "lineage" ? "block" : "none" }} className="w-full h-full">
          {renderLineage()}
        </div>
        <div style={{ display: activeTab === "mapping" ? "block" : "none" }} className="w-full h-full">
          {renderMapping()}
        </div>
        <div style={{ display: activeTab === "sql" ? "block" : "none" }} className="w-full h-full">
          {renderSQL()}
        </div>
      </>
    );
  };

  const currentState = viewStates[activeTab];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/create-project")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-lg font-semibold">{projectName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {tabList.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
                }`}
            >
              {t.Icon && <t.Icon className="w-4 h-4" />}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <section
          ref={canvasRef}
          className="w-full h-full relative overflow-hidden bg-muted/10"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {shouldShowControls && (
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <div className="bg-background border border-border rounded-md shadow-sm p-1 flex flex-col gap-1">
                <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In">+</Button>
                <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out">-</Button>
                <Button variant="ghost" size="icon" onClick={resetView} title="Reset">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant={currentState.isPanMode ? "secondary" : "outline"}
                size="icon"
                onClick={togglePanMode}
                title="Toggle Pan Mode"
                className="shadow-sm"
              >
                <Move className="w-4 h-4" />
              </Button>
            </div>
          )}

          {renderAllTabs()}
        </section>
      </main>
    </div>
  );
};

export default Visualization;
