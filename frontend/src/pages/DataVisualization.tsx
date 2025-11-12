// src/pages/DataVisualization.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import DbDocPanel from "@/components/DbDocPanel";
import LineageGraph from "@/components/LineageGraph";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthProvider";
import {
  ArrowLeft,
  Search,
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

type TableShape = { name: string; columns?: string[] };

const DataVisualization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // Read navigation state safely
  const nav = (location.state || {}) as any;
  const projectName = nav.projectName || "Untitled Project";
  const engine = nav.engine || "Unknown Engine";
  // allow either `tables` passed or empty array
  const initialTables: TableShape[] = Array.isArray(nav.tables)
    ? nav.tables
    : [];

  // Local state
  const [lineage, setLineage] = useState<any | null>(null);
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">(
    "table"
  );
  const [activeTab, setActiveTab] = useState<string>("er-diagram");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [tables] = useState<TableShape[]>(initialTables);

  const tabs = [
    { id: "schema", label: "Schema", icon: FileText },
    { id: "er-diagram", label: "ER Diagram", icon: Share2 },
    { id: "lineage", label: "Lineage", icon: GitBranch },
    { id: "mappings", label: "Mappings", icon: Map },
  ];

  const handleLogout = () => {
    try {
      logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Called by DbDocPanel when artifacts are generated
  const handleArtifacts = (artifacts: {
    csv?: string;
    mermaids?: any[];
    lineage?: any;
  }) => {
    // safe guard: if lineage exists set it, else clear
    if (artifacts && artifacts.lineage) setLineage(artifacts.lineage);
    else setLineage(null);
  };

  const renderSchemaView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tables, columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {(tables || []).length === 0 ? (
        <div className="h-[400px] bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Schema Data</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Upload a DSL file and validate it to see your database schema
                structure here. Use the ER Diagram tab to generate artifacts.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {(tables || [])
            .filter(
              (table) =>
                table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (table.columns || []).some((col: string) =>
                  col.toLowerCase().includes(searchQuery.toLowerCase())
                )
            )
            .map((table) => (
              <Card key={table.name} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Table className="w-4 h-4" />
                    {table.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge variant="secondary" className="text-xs">
                      {(table.columns || []).length} columns
                    </Badge>
                    <div className="space-y-1">
                      {(table.columns || []).map((column) => (
                        <div
                          key={column}
                          className="text-sm text-muted-foreground flex items-center gap-2"
                        >
                          <div className="w-2 h-2 bg-primary rounded-full" />
                          {column}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );

  const renderERDiagram = () => {
    return (
      <div className="w-full h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Left: DSL editor with DbDocPanel */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col">
            <h4 className="text-sm font-medium mb-3">DSL Editor & Artifacts</h4>
            <div className="flex-1 min-h-0">
              {/* DbDocPanel should call onArtifacts when it generates artifacts */}
              <DbDocPanel onArtifacts={handleArtifacts} />
            </div>
          </div>

          {/* Right: Lineage Graph */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Data Lineage Graph</h4>
              <div className="flex gap-2">
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

            <div className="text-sm text-muted-foreground mb-3">
              {lineage
                ? `${lineage.nodes?.length || 0} nodes • ${lineage.edges?.length || 0} edges`
                : "No lineage data"}
            </div>

            <div className="flex-1 min-h-[420px] border border-border rounded-lg overflow-hidden">
              {lineage ? (
                <LineageGraph lineage={lineage} level={lineageLevel} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20">
                  <div className="text-center space-y-2">
                    <GitBranch className="w-12 h-12 mx-auto opacity-50" />
                    <p className="text-sm">No lineage available</p>
                    <p className="text-xs">Generate artifacts from DSL editor on the left</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLineageView = () => (
    <div className="w-full h-full">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Data Lineage Visualization</h4>
          <div className="flex gap-2">
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

        <div className="text-sm text-muted-foreground mb-3">
          {lineage
            ? `${lineage.nodes?.length || 0} nodes • ${lineage.edges?.length || 0} edges`
            : "No lineage data"}
        </div>

        <div className="flex-1 min-h-[500px] border border-border rounded-lg overflow-hidden">
          {lineage ? (
            <LineageGraph lineage={lineage} level={lineageLevel} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20">
              <div className="text-center space-y-4">
                <GitBranch className="w-16 h-16 mx-auto opacity-50" />
                <div>
                  <h3 className="text-lg font-medium">No Data Lineage Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Go to the ER Diagram tab and generate artifacts from your DSL 
                    to visualize data lineage and dependencies.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMappingsView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search mappings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          Sort by Table
        </Button>
      </div>

      <div className="h-[400px] bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Map className="w-16 h-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-medium">No Mappings Available</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Table relationships and column mappings will appear here once your
              DSL is processed and relationships are identified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeTab) {
      case "schema":
        return renderSchemaView();
      case "er-diagram":
        return renderERDiagram();
      case "lineage":
        return renderLineageView();
      case "mappings":
        return renderMappingsView();
      default:
        return renderERDiagram();
    }
  };

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
              onClick={() => navigate("/create-project")}
              className="flex items-center gap-2 px-3 transition-colors hover:text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Back to project"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Project</span>
            </Button>
          </div>

          {/* User Menu */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 z-30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-10 rounded-full p-0 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="User menu"
                >
                  <Avatar>
                    <AvatarFallback>VJ</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Vinit Jain</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      vinit.jain@example.com
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Branding */}
          <div className="container flex items-center justify-between w-full pl-[160px] pr-[160px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col leading-tight">
                <h2 className="text-sm font-semibold whitespace-nowrap">DBDocManager</h2>
                <p className="text-xs text-muted-foreground">— {projectName}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center pointer-events-none">
              <h1 className="text-lg font-semibold truncate max-w-[60vw]">{projectName}</h1>
              <p className="text-sm text-muted-foreground">
                {engine ? `${engine} Database Visualization` : "Database Visualization"}
              </p>
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
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        ACTIVE
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Database className="w-3 h-3 mr-1" />
                  {(tables || []).length} tables
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto">{renderMainContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
