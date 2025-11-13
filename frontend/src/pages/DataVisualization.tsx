// src/pages/DataVisualization.tsx
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

  // Artifacts from backend (CSV, mermaids, lineage)
  const [lineage, setLineage] = useState<any | null>(null);
  const [mermaids, setMermaids] = useState<Array<{name:string,content:string}>>([]);
  const [csvMapping, setCsvMapping] = useState<string | null>(null);

  // UI & parsed DSL fallback
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [activeTab, setActiveTab] = useState("er-diagram");
  const [parsedTables, setParsedTables] = useState<any[]>([]);

  // Input state passed from CreateProject
  const projectData = {
    projectName: (location.state as any)?.projectName || "Untitled Project",
    engine: (location.state as any)?.engine || "Unknown Engine",
    tables: (location.state as any)?.tables || [],
    dslContent: (location.state as any)?.dslContent || "",
    parsedData: (location.state as any)?.parsedData || null,
    artifacts: (location.state as any)?.artifacts || null,
  };

  // On mount: if artifacts present in navigation state, use them
  useEffect(() => {
    const artifacts = projectData.artifacts;
    if (artifacts) {
      setCsvMapping(artifacts.csv || null);
      setMermaids(Array.isArray(artifacts.mermaids) ? artifacts.mermaids : []);
      setLineage(artifacts.lineage || null);
    }
    // also try to populate parsedTables from passed parsedData or DSL content
    if (projectData.parsedData && Array.isArray(projectData.parsedData.tables)) {
      setParsedTables(projectData.parsedData.tables.map((t: any) => ({ name: t, columns: [] })));
    } else if (projectData.dslContent) {
      parseDSLContent(projectData.dslContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse DSL content to extract tables and columns (keeps your existing parser)
  const parseDSLContent = (dslContent: string) => {
    if (!dslContent || !dslContent.trim()) {
      setParsedTables([]);
      return;
    }

    try {
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

        if (trimmedLine === 'targets:') {
          inTargetsSection = true;
          continue;
        }
        if (inTargetsSection && indentLevel === 0 && trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
          if (!['tables:', 'db:', 'engine:', 'schema:'].some(keyword => trimmedLine.startsWith(keyword))) {
            inTargetsSection = false;
            inTablesSection = false;
            inColumnsSection = false;
          }
        }
        if (!inTargetsSection) continue;
        if (trimmedLine === 'tables:') {
          inTablesSection = true;
          inColumnsSection = false;
          continue;
        }
        if (!inTablesSection) continue;
        if (trimmedLine.startsWith('- name:') && indentLevel <= 8) {
          if (currentTable) {
            tables.push(currentTable);
          }
          const tableNameMatch = trimmedLine.match(/- name:\s*(.+)/);
          if (tableNameMatch) {
            currentTable = { name: tableNameMatch[1].trim(), columns: [] };
            tableIndentLevel = indentLevel;
            inColumnsSection = false;
          }
        } else if (currentTable && trimmedLine === 'columns:' && indentLevel > tableIndentLevel) {
          inColumnsSection = true;
          continue;
        } else if (currentTable && inColumnsSection) {
          if (trimmedLine.startsWith('- {') && trimmedLine.includes('name:')) {
            const nameMatch = trimmedLine.match(/name:\s*([^,}]+)/);
            const typeMatch = trimmedLine.match(/type:\s*([^,}]+)/);
            if (nameMatch) {
              const columnName = nameMatch[1].trim();
              const columnType = typeMatch ? typeMatch[1].trim() : 'unknown';
              currentTable.columns.push(`${columnName} : ${columnType}`);
            }
          } else if (trimmedLine.startsWith('- name:')) {
            const columnNameMatch = trimmedLine.match(/- name:\s*(.+)/);
            if (columnNameMatch) {
              const columnName = columnNameMatch[1].trim();
              let columnType = 'unknown';
              for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const nextLine = lines[j].trim();
                const typeMatch = nextLine.match(/type:\s*(.+)/);
                if (typeMatch) {
                  columnType = typeMatch[1].trim();
                  break;
                }
                if (nextLine.startsWith('- ') || (lines[j].length - lines[j].trimStart().length <= tableIndentLevel && lines[j].trim() !== '')) {
                  break;
                }
              }
              currentTable.columns.push(`${columnName} : ${columnType}`);
            }
          } else if (indentLevel <= tableIndentLevel && trimmedLine !== '') {
            inColumnsSection = false;
          }
        }
      }
      if (currentTable) tables.push(currentTable);
      setParsedTables(tables);
    } catch (error) {
      console.error('Error parsing DSL content:', error);
      setParsedTables([]);
    }
  };

  // Useful small helper to render CSV mapping as HTML table (very basic)
  const renderCsvMappingTable = (csvString: string | null) => {
    if (!csvString) return <div className="text-sm text-muted-foreground">No mapping CSV available.</div>;
    const rows = csvString.trim().split('\n').map(r => r.split(','));
    const header = rows.shift() || [];
    return (
      <div className="overflow-auto max-h-[420px]">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/10 sticky top-0">
            <tr>
              {header.map((h, idx) => <th key={idx} className="px-2 py-1 text-left text-xs text-muted-foreground">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white/50" : ""}>
                {r.map((c, j) => <td key={j} className="px-2 py-1 font-mono text-xs">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ER Diagram view: use server mermaid if present; fallback to parsedTables card view
  const renderERDiagram = () => {
    return (
      <div className="w-full h-full p-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Entity Relationship Diagram</h3>
          </div>

          <div className="flex-1 min-h-[500px]">
            {mermaids && mermaids.length > 0 ? (
              <div className="h-full w-full bg-white rounded-lg border overflow-auto">
                <div 
                  id="erd-container" 
                  className="p-4 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: mermaids[0].content || "" }}
                />
              </div>
            ) : (parsedTables.length > 0) ? (
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
                            <div key={`parsed-${table.name}-col-${index}`} className="text-sm flex items-center gap-2 p-2 bg-muted/30 rounded">
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
                            <div key={`project-${table.name}-col-${index}`} className="text-sm flex items-center gap-2 p-2 bg-muted/30 rounded">
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

  // Lineage view — uses lineage JSON returned by server (or local fallback)
  const renderLineageView = () => {
    return (
      <div className="w-full h-full p-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Data Lineage</h3>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button size="sm" variant={lineageLevel === "table" ? "secondary" : "outline"} onClick={() => setLineageLevel("table")}>Table-level</Button>
                <Button size="sm" variant={lineageLevel === "column" ? "secondary" : "outline"} onClick={() => setLineageLevel("column")}>Column-level</Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {lineage ? `${lineage.nodes?.length || 0} nodes • ${(lineage.edges?.length || 0) + (lineage.table_edges?.length || 0)} edges` : "No data loaded"}
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
                      Data lineage visualization will show how data flows and dependencies across your database schema once DSL is processed.
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

  // Mappings view shows CSV mapping (server-generated) if available
  const renderMappingsView = () => {
    return (
      <div className="w-full h-full p-6">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Mapping Matrix</h3>
            <div>
              {csvMapping && (
                <Button size="sm" variant="outline" onClick={() => {
                  // download CSV
                  const blob = new Blob([csvMapping], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mapping_matrix.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Download CSV</Button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-[500px]">
            {csvMapping ? (
              <div className="p-2">{renderCsvMappingTable(csvMapping)}</div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-center space-y-4">
                  <Map className="w-16 h-16 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium">No Mappings Available</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Mapping matrix will appear here once you generate artifacts from the DSL.
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

  const tabs = [
    { id: "schema", label: "Schema", icon: FileText },
    { id: "er-diagram", label: "ER Diagram", icon: Share2 },
    { id: "lineage", label: "Lineage", icon: GitBranch },
    { id: "mappings", label: "Mappings", icon: Map },
  ];

  const handleLogout = () => logout();

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

  function renderSchemaView() {
    return (
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
  }

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
                  uploadedFileName: (location.state as any)?.uploadedFileName,
                  parsedData: projectData.parsedData
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
