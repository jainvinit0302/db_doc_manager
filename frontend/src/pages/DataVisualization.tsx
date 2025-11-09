import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Search,
  ZoomIn,
  ZoomOut,
  Move,
  Database,
  Share2,
  GitBranch,
  Map,
  FileText,
  Table
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const DataVisualization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("er-diagram");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Project data from navigation state
  const projectData = {
    projectName: location.state?.projectName || "Untitled Project",
    engine: location.state?.engine || "Unknown Engine",
    tables: location.state?.tables || []
  };

  const tabs = [
    { id: "schema", label: "Schema", icon: FileText },
    { id: "er-diagram", label: "ER Diagram", icon: Share2 },
    { id: "lineage", label: "Lineage", icon: GitBranch },
    { id: "mappings", label: "Mappings", icon: Map }
  ];

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
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
      
      {(projectData.tables || []).length === 0 ? (
        <div className="h-[400px] bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Schema Data</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Upload a DSL file and validate it to see your database schema structure here.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {(projectData.tables || []).filter(table => 
            table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (table.columns || []).some(col => col.toLowerCase().includes(searchQuery.toLowerCase()))
          ).map((table) => (
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
                      <div key={column} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
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

  const renderERDiagram = () => (
    <div className="relative h-full">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <div className="flex items-center gap-1 bg-background border rounded-lg px-3 py-2">
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2">{zoomLevel}%</span>
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline">
          <Move className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Interactive Canvas Area */}
      <div className="h-full bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Share2 className="w-16 h-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-medium">No ER Diagram Available</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Upload and validate your DSL to generate an interactive Entity-Relationship diagram 
              showing table relationships and data flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLineageView = () => (
    <div className="h-full bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <GitBranch className="w-16 h-16 mx-auto text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">No Data Lineage Available</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Data lineage visualization will show how data flows and dependencies 
            across your database schema once DSL is processed.
          </p>
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
              Table relationships and column mappings will appear here once 
              your DSL is processed and relationships are identified.
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
        <div className="container flex h-16 items-center px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/create-project")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{projectData.projectName}</h1>
            <p className="text-sm text-muted-foreground">{projectData.engine} Database Visualization</p>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Fixed Tabs */}
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
                    {tab.id === "er-diagram" && activeTab === tab.id && (
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Database className="w-3 h-3 mr-1" />
                  {(projectData.tables || []).length} tables
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-6">
            {renderMainContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
