import React, { useState, useEffect } from "react";
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

const DataVisualization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [lineage, setLineage] = useState<any | null>(null);
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [activeTab, setActiveTab] = useState("er-diagram");
  const [parsedTables, setParsedTables] = useState<any[]>([]);

  const projectData = {
    projectName: location.state?.projectName || "Untitled Project",
    engine: location.state?.engine || "Unknown Engine",
    tables: location.state?.tables || [],
    dslContent: location.state?.dslContent || "",
  };

  // Parse DSL content to extract tables and columns
  const parseDSLContent = (dslContent: string) => {
    if (!dslContent || !dslContent.trim()) {
      setParsedTables([]);
      return;
    }

    try {
      // Parse YAML-like DSL content to extract tables from targets section
      const lines = dslContent.split('\n');
      const tables: any[] = [];
      let inTargetsSection = false;
      let inTablesSection = false;
      let currentTable: any = null;
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

  // Parse DSL content when component mounts or DSL content changes
  useEffect(() => {
    if (projectData.dslContent) {
      parseDSLContent(projectData.dslContent);
    }
  }, [projectData.dslContent]);

  // Generate lineage when tables are parsed
  useEffect(() => {
    if (projectData.dslContent && parsedTables.length > 0) {
      generateLineageFromDSL(projectData.dslContent, parsedTables);
    }
  }, [parsedTables, projectData.dslContent]);

  // Generate basic lineage data from DSL content for visualization
  const generateLineageFromDSL = (dslContent: string, tables: any[]) => {
    if (!dslContent || !dslContent.trim() || tables.length === 0) {
      return;
    }

    try {
      const lines = dslContent.split('\n');
      const nodes: any[] = [];
      const edges: any[] = [];
      const tableEdges: any[] = [];
      
      // Parse sources
      let inSourcesSection = false;
      let inMappingsSection = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const indentLevel = line.length - line.trimStart().length;
        
        // Check for sources section
        if (trimmedLine === 'sources:') {
          inSourcesSection = true;
          inMappingsSection = false;
          continue;
        }
        
        // Check for mappings section
        if (trimmedLine === 'mappings:') {
          inMappingsSection = true;
          inSourcesSection = false;
          continue;
        }
        
        // Exit sections if we hit another top-level section
        if (indentLevel === 0 && trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
          if (!['sources:', 'mappings:'].includes(trimmedLine)) {
            inSourcesSection = false;
            inMappingsSection = false;
          }
        }
        
        // Parse source nodes
        if (inSourcesSection && trimmedLine.startsWith('- id:')) {
          const idMatch = trimmedLine.match(/- id:\s*(.+)/);
          if (idMatch) {
            const sourceId = idMatch[1].trim();
            nodes.push({
              id: `src:${sourceId}`,
              label: sourceId,
              type: 'source',
              meta: {}
            });
          }
        }
        
        // Parse mappings to create edges
        if (inMappingsSection && trimmedLine.startsWith('- target:')) {
          const targetMatch = trimmedLine.match(/- target:\s*(.+)/);
          if (targetMatch) {
            const target = targetMatch[1].trim();
            
            // Look for the 'from:' section in the next few lines
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
              const nextLine = lines[j].trim();
              
              // Check for source_id mapping
              if (nextLine.startsWith('source_id:')) {
                const sourceMatch = nextLine.match(/source_id:\s*(.+)/);
                if (sourceMatch) {
                  const sourceId = sourceMatch[1].trim();
                  
                  // Create edge from source to target column
                  edges.push({
                    id: `edge_${sourceId}_to_${target.replace(/\./g, '_')}`,
                    source: `src:${sourceId}`,
                    target: target,
                    type: 'column_lineage',
                    meta: {}
                  });
                  
                  // Add target column as a node if not exists
                  if (!nodes.find(n => n.id === target)) {
                    nodes.push({
                      id: target,
                      label: target.split('.').pop() || target,
                      type: 'column',
                      meta: {}
                    });
                  }
                  break;
                }
              }
              
              // Check for rule mapping (no source_id)
              if (nextLine.startsWith('rule:')) {
                const ruleMatch = nextLine.match(/rule:\s*(.+)/);
                if (ruleMatch) {
                  const ruleName = ruleMatch[1].trim().replace(/['"]/g, '');
                  const ruleNodeId = `rule:${ruleName}`;
                  
                  // Add rule node if not exists
                  if (!nodes.find(n => n.id === ruleNodeId)) {
                    nodes.push({
                      id: ruleNodeId,
                      label: ruleName,
                      type: 'rule',
                      meta: {}
                    });
                  }
                  
                  // Create edge from rule to target
                  edges.push({
                    id: `edge_rule_to_${target.replace(/\./g, '_')}`,
                    source: ruleNodeId,
                    target: target,
                    type: 'column_lineage',
                    meta: {}
                  });
                  
                  // Add target column as a node if not exists
                  if (!nodes.find(n => n.id === target)) {
                    nodes.push({
                      id: target,
                      label: target.split('.').pop() || target,
                      type: 'column',
                      meta: {}
                    });
                  }
                  break;
                }
              }
              
              // Stop looking if we hit another mapping
              if (nextLine.startsWith('- target:') || lines[j].length - lines[j].trimStart().length === 0) {
                break;
              }
            }
          }
        }
      }
      
      // Add table nodes from parsed tables
      tables.forEach(table => {
        nodes.push({
          id: table.name,
          label: table.name,
          type: 'table',
          meta: { columns: table.columns }
        });
      });
      
      // Create table-level edges based on foreign key relationships
      tables.forEach(table => {
        table.columns.forEach((column: string) => {
          // Look for foreign key relationships in the original DSL
          if (column.includes('product_id') && table.name === 'fct_sales') {
            // Create relationship from dim_product to fct_sales
            const sourceTable = 'dim_product';
            if (tables.find(t => t.name === sourceTable)) {
              tableEdges.push({
                id: `table_edge_${sourceTable}_${table.name}`,
                source: sourceTable,
                target: table.name,
                type: 'table_lineage',
                meta: { relationship: 'foreign_key' }
              });
            }
          }
        });
      });
      
      // Create source to table relationships
      const sourceToTableMap: { [key: string]: string[] } = {
        'mongo_products': ['dim_product'],
        'pg_sales': ['fct_sales']
      };
      
      Object.entries(sourceToTableMap).forEach(([sourceId, targetTables]) => {
        targetTables.forEach(targetTable => {
          if (tables.find(t => t.name === targetTable)) {
            tableEdges.push({
              id: `table_edge_src_${sourceId}_${targetTable}`,
              source: `src:${sourceId}`,
              target: targetTable,
              type: 'table_lineage',
              meta: { relationship: 'feeds_into' }
            });
          }
        });
      });
      
      console.log('Generated lineage data:', { nodes, edges, tableEdges });
      
      // Set the generated lineage data
      setLineage({
        nodes,
        edges,
        table_edges: tableEdges
      });
      
    } catch (error) {
      console.error('Error generating lineage from DSL:', error);
    }
  };

  const tabs = [
    { id: "schema", label: "Schema", icon: FileText },
    { id: "er-diagram", label: "ER Diagram", icon: Share2 },
    { id: "lineage", label: "Lineage", icon: GitBranch },
    { id: "mappings", label: "Mappings", icon: Map },
  ];

  const handleLogout = () => logout();

  const renderSchemaView = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Schema View</h3>
          <p className="text-sm text-muted-foreground">
            Schema visualization and editing features will be implemented in future releases.
          </p>
        </div>
      </div>
    </div>
  );

  // ✅ ER Diagram View - Shows Tables and Relationships
  const renderERDiagram = () => {
    return (
      <div className="w-full h-full p-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Entity Relationship Diagram</h3>
          </div>

          <div className="flex-1 min-h-[500px]">
            {lineage && lineage.mermaids && lineage.mermaids.length > 0 ? (
              // Show the actual ER diagram from mermaid
              <div className="h-full w-full bg-white rounded-lg border overflow-auto">
                <div 
                  id="erd-container" 
                  className="p-4"
                  dangerouslySetInnerHTML={{
                    __html: lineage.mermaids[0]?.content || ""
                  }}
                />
              </div>
            ) : (parsedTables.length > 0) ? (
              // Show table cards from parsed DSL content
              <div className="h-full overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {parsedTables.map((table) => (
                    <Card key={`parsed-${table.name}`} className="hover:shadow-lg transition-shadow border-2">
                      <CardHeader className="pb-3 bg-primary/5">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Table className="w-5 h-5 text-primary" />
                          {table.name}
                        </CardTitle>
                        <Badge variant="secondary" className="w-fit text-xs">
                          {(table.columns || []).length} columns
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="space-y-2">
                          {(table.columns || []).map((column: string, index: number) => (
                            <div
                              key={`parsed-${table.name}-col-${index}`}
                              className="text-sm flex items-center gap-2 p-2 bg-muted/30 rounded"
                            >
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              <span className="font-mono text-xs">{column}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (projectData.tables && projectData.tables.length > 0) ? (
              // Fallback: Show table cards from project data
              <div className="h-full overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {projectData.tables.map((table) => (
                    <Card key={`project-${table.name}`} className="hover:shadow-lg transition-shadow border-2">
                      <CardHeader className="pb-3 bg-primary/5">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Table className="w-5 h-5 text-primary" />
                          {table.name}
                        </CardTitle>
                        <Badge variant="secondary" className="w-fit text-xs">
                          {(table.columns || []).length} columns
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="space-y-2">
                          {(table.columns || []).map((column, index) => (
                            <div
                              key={`project-${table.name}-col-${index}`}
                              className="text-sm flex items-center gap-2 p-2 bg-muted/30 rounded"
                            >
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              <span className="font-mono text-xs">{column}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-center space-y-4">
                  <Database className="w-16 h-16 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">No ERD Available</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Upload DSL content on the project page and navigate here to view the Entity Relationship Diagram.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLineageView = () => {
    return (
      <div className="w-full h-full p-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Data Lineage</h3>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={
                    lineageLevel === "table" ? "secondary" : "outline"
                  }
                  onClick={() => setLineageLevel("table")}
                >
                  Table-level
                </Button>
                <Button
                  size="sm"
                  variant={
                    lineageLevel === "column" ? "secondary" : "outline"
                  }
                  onClick={() => setLineageLevel("column")}
                >
                  Column-level
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                {lineage
                  ? `${lineage.nodes?.length || 0} nodes • ${
                      (lineage.edges?.length || 0) + (lineage.table_edges?.length || 0)
                    } edges`
                  : "No data loaded"}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[500px]">
            {lineage ? (
              <LineageGraph lineage={lineage} level={lineageLevel} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-center space-y-4">
                  <GitBranch className="w-16 h-16 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">No Data Lineage Available</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Data lineage visualization will show how data flows and dependencies
                      across your database schema once DSL is processed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMappingsView = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Map className="w-16 h-16 mx-auto text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Mappings View</h3>
          <p className="text-sm text-muted-foreground">
            Data mapping and transformation features will be implemented in future releases.
          </p>
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
              onClick={() => navigate("/create-project", { 
                state: {
                  projectName: projectData.projectName,
                  dslContent: projectData.dslContent,
                  uploadedFileName: location.state?.uploadedFileName,
                  parsedData: location.state?.parsedData
                }
              })}
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

          {/* Center content area - simplified */}
          <div className="container flex items-center justify-center w-full pl-[160px] pr-[160px]">
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="text-lg font-semibold truncate max-w-[60vw]">
                {projectData?.projectName || "Untitled Project"}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-muted/30">
          <div className="p-4">
            <h2 className="font-medium text-sm text-muted-foreground mb-4">
              VIEWS
            </h2>
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

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Database className="w-3 h-3 mr-1" />
                  {parsedTables.length > 0 ? parsedTables.length : (projectData.tables || []).length} tables
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6">{renderMainContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
