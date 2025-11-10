// src/pages/visualization.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Layers,
  Share2,
  Box,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
} from "lucide-react";

type TabKey = "schema" | "erd" | "lineage" | "mapping";

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
];

type ViewState = {
  zoom: number;
  offset: { x: number; y: number };
  isPanMode: boolean;
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
  const [activeTab, setActiveTab] = useState<TabKey>("schema");
  const [search, setSearch] = useState("");

  // per-tab states (ERD and Lineage will use these; Schema & Mapping will ignore)
  const [viewStates, setViewStates] = useState<Record<TabKey, ViewState>>(() => {
    return {
      schema: defaultState(),
      erd: loadState("erd"),
      lineage: loadState("lineage"),
      mapping: defaultState(),
    };
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

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
    if (activeTab !== "erd" && activeTab !== "lineage") return;
    setActiveViewState((s) => ({ ...s, zoom: Math.min(s.zoom + ZOOM_STEP, MAX_ZOOM) }));
  }, [activeTab, setActiveViewState]);

  const zoomOut = useCallback(() => {
    if (activeTab !== "erd" && activeTab !== "lineage") return;
    setActiveViewState((s) => ({ ...s, zoom: Math.max(s.zoom - ZOOM_STEP, MIN_ZOOM) }));
  }, [activeTab, setActiveViewState]);

  const resetView = useCallback(() => {
    if (activeTab !== "erd" && activeTab !== "lineage") return;
    setActiveViewState(() => defaultState());
  }, [activeTab, setActiveViewState]);

  const togglePanMode = useCallback(() => {
    if (activeTab !== "erd" && activeTab !== "lineage") return;
    setActiveViewState((s) => ({ ...s, isPanMode: !s.isPanMode }));
  }, [activeTab, setActiveViewState]);

  // Wheel-to-zoom only for erd/lineage and only when ctrl/meta is pressed
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // only zoom when ctrl/cmd pressed and active tab supports controls
      if (!(activeTab === "erd" || activeTab === "lineage")) return;
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
    // only for erd and lineage when pan mode turned on
    if (!(activeTab === "erd" || activeTab === "lineage")) return;
    const current = viewStates[activeTab];
    if (!current.isPanMode) return;

    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const target = e.currentTarget as HTMLElement;
    target.style.userSelect = "none";
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !lastMouse.current) return;
    // only modify state for erd/lineage
    if (!(activeTab === "erd" || activeTab === "lineage")) return;
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
        // apply only when active tab supports zoom
        if (activeTab === "erd" || activeTab === "lineage") zoomIn();
      } else if (e.key === "-") {
        if (activeTab === "erd" || activeTab === "lineage") zoomOut();
      } else if (e.key === "0") {
        if (activeTab === "erd" || activeTab === "lineage") resetView();
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const idx = Number(e.key) - 1;
        setActiveTab(tabList[Math.min(idx, tabList.length - 1)].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, zoomIn, zoomOut, resetView]);

  // Helper to decide if we should display in-canvas controls (only ERD & Lineage)
  const shouldShowControls = useMemo(() => activeTab === "erd" || activeTab === "lineage", [activeTab]);

  // Renderers
  const renderSchema = () => (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">Schema</h3>
      <p className="text-sm text-muted-foreground mb-4">Table/column structure (full-canvas, no zoom/pan).</p>
      <div className="bg-card border border-border rounded-lg h-[340px] p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="pb-2">Table</th>
              <th className="pb-2">Columns</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="py-2">users</td><td className="py-2">id, name, email</td></tr>
            <tr className="border-t"><td className="py-2">orders</td><td className="py-2">id, user_id, amount</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderERD = () => {
    const s = viewStates.erd;
    return (
      <div className="w-full h-full p-6">
        <h3 className="text-xl font-semibold mb-3">ERD</h3>
        <p className="text-sm text-muted-foreground mb-4">Entity-relationship diagram (supports zoom & pan).</p>
        <div className="bg-card border border-border rounded-lg h-[340px] p-4 overflow-hidden">
          <div
            style={{
              transform: `translate(${s.offset.x}px, ${s.offset.y}px) scale(${s.zoom / 100})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
            }}
            className="flex items-center justify-center text-muted-foreground"
          >
            [ERD Canvas Placeholder — integrate renderer here]
          </div>
        </div>
      </div>
    );
  };

  const renderLineage = () => {
    const s = viewStates.lineage;
    return (
      <div className="w-full h-full p-6">
        <h3 className="text-xl font-semibold mb-3">Lineage Graph</h3>
        <p className="text-sm text-muted-foreground mb-4">Data lineage (supports zoom & pan).</p>
        <div className="bg-card border border-border rounded-lg h-[340px] p-4 overflow-hidden">
          <div
            style={{
              transform: `translate(${s.offset.x}px, ${s.offset.y}px) scale(${s.zoom / 100})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
            }}
            className="flex items-center justify-center text-muted-foreground"
          >
            [Lineage Graph Placeholder — integrate renderer here]
          </div>
        </div>
      </div>
    );
  };

  const renderMapping = () => (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">Mappings</h3>
      <p className="text-sm text-muted-foreground mb-4">Full-canvas view (no zoom/pan controls).</p>
      <div className="bg-card border border-border rounded-lg h-[340px] p-4 overflow-auto text-muted-foreground">
        Mapping editor placeholder.
      </div>
    </div>
  );

  const renderActive = () => {
    switch (activeTab) {
      case "schema":
        return renderSchema();
      case "erd":
        return renderERD();
      case "lineage":
        return renderLineage();
      case "mapping":
        return renderMapping();
      default:
        return null;
    }
  };

  // convenience current view state for ERD/Lineage
  const currentState = viewStates[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
            {/* LEFT: Back button + Branding */}
            <div className="flex items-center gap-4">
            <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2"
            >
                ← Back
            </Button>

            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col leading-tight">
                <h1 className="text-lg font-semibold flex items-center gap-1">
                    DBDocManager <span className="text-muted-foreground">— Untitled Project</span>
                </h1>
                </div>
            </div>
            </div>

            {/* RIGHT: Search bar */}
            <div className="flex items-center gap-4 max-w-md w-full">
            <div className="relative flex-1">
                <Input
                type="search"
                placeholder="Search tables, fields..."
                className="pl-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search"
                />
            </div>
            </div>
        </div>
        </header>

      <main className="container px-4 py-6">
        {/* tabs */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3" role="tablist">
            {tabList.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                role="tab"
                aria-selected={activeTab === t.key}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border ${
                  activeTab === t.key
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "bg-transparent border-border text-muted-foreground hover:bg-muted/5"
                }`}
              >
                {t.Icon ? <t.Icon className="w-4 h-4" /> : null}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas wrapper */}
        <section
          ref={canvasRef}
          className="relative bg-card border border-border rounded-lg overflow-hidden select-none"
          style={{ minHeight: 420 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* In-canvas controls — only for ERD & Lineage */}
          {shouldShowControls && (
            <div className="absolute top-3 right-3 z-20">
              <div className="rounded-md bg-background border border-border px-2 py-1 flex items-center gap-2 shadow-sm">
                {/* We intentionally remove +/- UI per your request */}
                <div className="text-sm font-medium px-3">{currentState.zoom}%</div>

                <button
                  onClick={togglePanMode}
                  aria-pressed={currentState.isPanMode}
                  title="Toggle hand / pan mode"
                  className={`p-2 rounded ${currentState.isPanMode ? "bg-primary/10" : "hover:bg-muted/5"}`}
                >
                  <Move className="w-4 h-4" />
                </button>

                <button onClick={resetView} title="Reset zoom & pan" className="p-2 rounded hover:bg-muted/5">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {/* Render the active view. For ERD/Lineage we already apply transform inside renderer function. */}
          <div style={{ width: "100%", height: "100%" }}>{renderActive()}</div>
        </section>
      </main>
    </div>
  );
};

export default Visualization;
