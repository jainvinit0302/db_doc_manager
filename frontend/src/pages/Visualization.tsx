// src/pages/visualization.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Database, Layers, Share2, Box } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Visualization page
 *
 * Tabs:
 * - Schema
 * - ERD
 * - Lineage graph
 * - Mapping
 *
 * Each tab renders a placeholder panel which you can replace with your actual
 * visualization components (e.g. canvas, react-flow, mermaid, cytoscape, etc.).
 */

type TabKey = "schema" | "erd" | "lineage" | "mapping";

const tabList: { key: TabKey; label: string; Icon?: React.ComponentType<any> }[] = [
  { key: "schema", label: "Schema", Icon: Database },
  { key: "erd", label: "ERD", Icon: Layers },
  { key: "lineage", label: "Lineage graph", Icon: Share2 },
  { key: "mapping", label: "Mapping", Icon: Box },
];

const TabButton: React.FC<{
  active: boolean;
  label: string;
  Icon?: React.ComponentType<any>;
  onClick: () => void;
  id: string;
}> = ({ active, label, Icon, onClick, id }) => {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border ${
        active
          ? "bg-primary/10 border-primary text-primary font-medium"
          : "bg-transparent border-border text-muted-foreground hover:bg-muted/5"
      } focus:outline-none focus:ring-2 focus:ring-primary/30`}
    >
      {Icon ? <Icon className="w-4 h-4" /> : null}
      <span>{label}</span>
    </button>
  );
};

const SchemaView: React.FC = () => {
  return (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">Schema</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Show table/column structure, data types, constraints, indexes, etc.
      </p>

      <div className="bg-card border border-border rounded-lg h-[420px] p-4 overflow-auto">
        {/* Replace the content below with your schema viewer / table */}
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="pb-2">Table</th>
              <th className="pb-2">Columns</th>
              <th className="pb-2">Primary Key</th>
              <th className="pb-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-3">users</td>
              <td className="py-3">id, name, email, created_at</td>
              <td className="py-3">id</td>
              <td className="py-3">2025-11-01</td>
            </tr>
            <tr className="border-t">
              <td className="py-3">orders</td>
              <td className="py-3">id, user_id, amount, status</td>
              <td className="py-3">id</td>
              <td className="py-3">2025-11-05</td>
            </tr>
            {/* add more sample rows or map real data */}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ERDView: React.FC = () => {
  return (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">ERD</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Entity-relationship diagram for your selected project / schema.
      </p>

      <div className="bg-card border border-border rounded-lg h-[420px] flex items-center justify-center">
        {/* Replace this area with your ERD renderer (SVG, react-diagrams, mermaid, etc.) */}
        <div className="text-center text-muted-foreground">
          <div className="mb-2">[ERD Canvas Placeholder]</div>
          <div className="text-xs">Use your ERD rendering library here.</div>
        </div>
      </div>
    </div>
  );
};

const LineageView: React.FC = () => {
  return (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">Lineage graph</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Visualize upstream/downstream dependencies for selected tables/fields.
      </p>

      <div className="bg-card border border-border rounded-lg h-[420px] p-4 overflow-hidden">
        {/* Replace with react-flow / dagre / cytoscape graph */}
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          [Lineage graph / interactive graph placeholder]
        </div>
      </div>
    </div>
  );
};

const MappingView: React.FC = () => {
  return (
    <div className="w-full h-full p-6">
      <h3 className="text-xl font-semibold mb-3">Mapping</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Map fields / transformations between sources and targets.
      </p>

      <div className="bg-card border border-border rounded-lg h-[420px] p-4 overflow-auto">
        {/* Replace with mapping UI: mapping table, code preview, transformation steps */}
        <div className="text-muted-foreground">[Mapping/editor placeholder]</div>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2">Source Field</th>
                <th className="pb-2">Target Field</th>
                <th className="pb-2">Transformation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-3">user.email</td>
                <td className="py-3">customers.email</td>
                <td className="py-3">lowercase()</td>
              </tr>
              <tr className="border-t">
                <td className="py-3">order.total</td>
                <td className="py-3">invoices.amount</td>
                <td className="py-3">round(2)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Visualization: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("schema");
  const [search, setSearch] = useState("");

  const renderActive = () => {
    switch (activeTab) {
      case "schema":
        return <SchemaView />;
      case "erd":
        return <ERDView />;
      case "lineage":
        return <LineageView />;
      case "mapping":
        return <MappingView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar - reuse a small header similar to Dashboard */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">DBDocManager — Visualize</h1>
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-md mx-8">
            <div className="relative flex-1">
              <Input
                type="search"
                placeholder="Search tables, fields..."
                className="pl-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        {/* Tabs row */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" role="tablist" aria-label="Visualization tabs">
              {tabList.map((t) => (
                <TabButton
                  key={t.key}
                  id={`tab-${t.key}`}
                  active={activeTab === t.key}
                  label={t.label}
                  Icon={t.Icon}
                  onClick={() => setActiveTab(t.key)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => alert("Export - implement as needed")}>Export</Button>
              <Button onClick={() => alert("Settings - open modal or settings page")}>Settings</Button>
            </div>
          </div>
        </div>

        {/* Canvas / Panel */}
        <section
          aria-live="polite"
          className="bg-card border border-border rounded-lg overflow-hidden"
          style={{ minHeight: "480px" }}
        >
          {/* Optionally show a small header inside canvas identifying active tab */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tabList.find((t) => t.key === activeTab)?.Icon ? (
                React.createElement(tabList.find((t) => t.key === activeTab)!.Icon!, {
                  className: "w-5 h-5 text-muted-foreground",
                })
              ) : null}
              <h2 className="text-lg font-semibold">
                {tabList.find((t) => t.key === activeTab)?.label}
              </h2>
            </div>

            <div className="text-sm text-muted-foreground">
              {/* Add quick controls relevant to the active tab if needed */}
              {activeTab === "lineage" ? "Drag to pan · Zoom with mouse wheel" : null}
            </div>
          </div>

          {/* Active view */}
          <div className="p-6">{renderActive()}</div>
        </section>
      </main>
    </div>
  );
};

export default Visualization;
