// src/pages/CreateProject.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Upload,
  FileText,
  Database,
  Check,
  AlertCircle,
  Play,
  Save,
  BarChart3,
  LogOut,
  User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthProvider";

const CreateProject = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const handleLogout = () => {
    try {
      logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const [projectName, setProjectName] = useState("");
  const [selectedEngine, setSelectedEngine] = useState("");
  const [dslContent, setDslContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [generatedSQL, setGeneratedSQL] = useState("");

  // validation states
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const engines = [
    { id: "postgres", name: "PostgreSQL", icon: "🐘" },
    { id: "mysql", name: "MySQL", icon: "🐬" },
    { id: "snowflake", name: "Snowflake", icon: "❄️" },
    { id: "mongodb", name: "MongoDB", icon: "🍃" },
  ];

  // Helper to normalize backend responses for validation results
  const normalizeValidation = (vr: any) => {
    if (!vr) return { ajvErrors: [], referentialErrors: [], referentialWarnings: [] };

    const ajvErrors =
      vr.ajvErrors ||
      vr.ajv_errors ||
      (Array.isArray(vr.errors) && vr.errors.find((x: any) => x.keyword)) ||
      [];

    const referentialErrors =
      vr.referentialErrors ||
      vr.referential?.errors ||
      vr.errors?.referentialErrors ||
      vr.errors ||
      vr.referentialErrors?.errors ||
      [];

    const referentialWarnings =
      vr.referentialWarnings ||
      vr.referential?.warnings ||
      vr.warnings ||
      vr.referentialWarnings?.warnings ||
      [];

    return { ajvErrors, referentialErrors, referentialWarnings };
  };

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDslContent(content);
      // Don't parse immediately - wait for validation
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0] as File);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const mockParseDSL = (content: string) => {
    // Parse DSL content more accurately based on YAML structure
    if (!content.trim()) {
      setParsedData({
        totalTables: 0,
        sources: 0,
        tables: [],
        relationships: 0,
        isValid: false,
      });
      return;
    }

    try {
      // Split content into lines for analysis
      const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      const tables = new Set<string>();
      const sources = new Set<string>();
      const mappings = new Set<string>();
      let totalColumns = 0;
      let relationships = 0;
      
      let currentSection = '';
      let inTablesList = false;
      let inSourcesList = false;
      let inMappingsList = false;
      let currentTable = '';
      let currentTableColumns = 0;
      
      lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        const trimmedLine = line.trim();
        
        // Detect main sections in YAML
        if (trimmedLine === 'targets:') {
          currentSection = 'targets';
          inTablesList = false;
          return;
        } else if (trimmedLine === 'sources:') {
          currentSection = 'sources';
          inSourcesList = true;
          return;
        } else if (trimmedLine === 'mappings:') {
          currentSection = 'mappings';
          inMappingsList = true;
          return;
        } else if (trimmedLine === 'notes:') {
          currentSection = 'notes';
          return;
        }
        
        // Detect sub-sections
        if (currentSection === 'targets') {
          if (trimmedLine === 'tables:' || lowerLine.includes('tables:')) {
            inTablesList = true;
            return;
          }
          
          if (inTablesList) {
            // Look for table name definitions
            if (trimmedLine.startsWith('- name:') || trimmedLine.match(/^-\s*name:\s*/)) {
              const nameMatch = trimmedLine.match(/^-?\s*name:\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
              if (nameMatch) {
                currentTable = nameMatch[1];
                tables.add(currentTable);
                currentTableColumns = 0;
              }
            }
            
            // Count columns for the current table
            if (trimmedLine.includes('{ name:') || (trimmedLine.includes('name:') && trimmedLine.includes('type:'))) {
              currentTableColumns++;
              totalColumns++;
            } else if (trimmedLine.startsWith('- { name:')) {
              currentTableColumns++;
              totalColumns++;
            }
          }
        } else if (currentSection === 'sources' && inSourcesList) {
          // Look for source definitions
          if (trimmedLine.startsWith('- id:') || trimmedLine.match(/^-\s*id:\s*/)) {
            const idMatch = trimmedLine.match(/^-?\s*id:\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (idMatch) {
              sources.add(idMatch[1]);
            }
          }
        } else if (currentSection === 'mappings' && inMappingsList) {
          // Look for mapping definitions
          if (trimmedLine.startsWith('- target:')) {
            const targetMatch = trimmedLine.match(/^-?\s*target:\s*(.+)/);
            if (targetMatch) {
              mappings.add(targetMatch[1]);
              relationships++;
            }
          }
        }
        
        // Alternative parsing patterns for different formats
        // YAML-style table definitions
        if (trimmedLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s*$/) && 
            currentSection !== 'sources' && currentSection !== 'mappings' && 
            !['project', 'owners', 'targets', 'sources', 'mappings', 'notes', 'tables', 'columns'].includes(trimmedLine.replace(':', ''))) {
          const tableName = trimmedLine.replace(':', '');
          tables.add(tableName);
        }
        
        // Look for column definitions in various formats
        if (trimmedLine.includes('name:') && trimmedLine.includes('type:') && !trimmedLine.includes('target:')) {
          totalColumns++;
        }
        
        // Count direct mapping relationships
        if (trimmedLine.includes('target:') && (trimmedLine.includes('from:') || index < lines.length - 1)) {
          relationships++;
        }
      });
      
      // If no sources detected from structure, try to find them in content
      if (sources.size === 0) {
        lines.forEach(line => {
          const sourceMatch = line.match(/source_id:\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (sourceMatch) {
            sources.add(sourceMatch[1]);
          }
        });
      }
      
      // Convert Set to Array with additional metadata
      const tableArray = Array.from(tables).map(name => ({
        name,
        columns: totalColumns > 0 && tables.size > 0 ? Math.ceil(totalColumns / tables.size) : 4 // Default to 4 based on your example
      }));

      setParsedData({
        totalTables: tables.size,
        sources: sources.size,
        tables: tableArray,
        relationships: Math.max(relationships, mappings.size),
        isValid: tables.size > 0 || sources.size > 0,
      });
      
    } catch (error) {
      console.error("Error parsing DSL:", error);
      setParsedData({
        totalTables: 0,
        sources: 0,
        tables: [],
        relationships: 0,
        isValid: false,
      });
    }
  };

  // NEW: mock artifact generator
  const mockGenerateArtifacts = (content: string, parsed: any) => {
    // Replace with real artifact generation (mermaid, lineage, csv) as needed.
    // This returns a small mocked shape that DataVisualization will consume.
    const tables = (parsed?.tables && parsed.tables.length > 0)
      ? parsed.tables
      : (content ? content.match(/^\s*\w+:/gm)?.map(s => s.replace(/:/, "").trim()) : []) || ["users", "orders"];

    const parsedTables = tables.map((t: any, idx: number) =>
      typeof t === "string" ? { name: t, columns: ["id", "name", "created_at"] } : t
    );

    // Mock lineage graph nodes/edges
    const nodes = parsedTables.map((t: any, i: number) => ({ id: `t${i}`, label: t.name }));
    const edges = parsedTables.length > 1 ? [{ from: nodes[0].id, to: nodes[1].id }] : [];

    // Simple mermaid ERD string (very simple)
    const mermaid = [
      "erDiagram",
      ...parsedTables.map((t: any) => `${t.name} {`),
      // note: keep small and safe (mermaid syntax is illustrative)
    ];

    // CSV preview (string)
    const csv = parsedTables.map((t: any) => `${t.name},${(t.columns || []).length}`).join("\n");

    return {
      csv,
      mermaids: [{ id: "erd-1", source: `erDiagram\n${parsedTables.map((t:any)=> `${t.name} {\n  id INT\n}`).join("\n")}` }],
      lineage: {
        nodes,
        edges,
      },
      tables: parsedTables,
      generatedAt: new Date().toISOString(),
    };
  };

  // NEW: call backend /api/validate
  const handleValidateDSL = async () => {
    // quick local guard
    if (!dslContent || !dslContent.trim()) {
      setValidationError("DSL is empty. Paste or upload DSL to validate.");
      setValidationResult(null);
      return;
    }

    setValidating(true);
    setValidationResult(null);
    setValidationError(null);

    try {
      // use relative path '/api/validate' so dev proxy or deployed host works
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: {
          "Content-Type": "text/yaml; charset=utf-8",
        },
        body: dslContent,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && data.error) ||
          (data && JSON.stringify(data)) ||
          `Server error ${res.status}`;
        setValidationError(String(msg));
        setValidationResult(null);
      } else {
        setValidationResult(data);
        // Update validity based on server validation result
        if (data && typeof data.valid === "boolean") {
          setParsedData((prev: any) => ({ 
            ...(prev || {}), 
            isValid: data.valid 
          }));
          // Only re-parse if validation was successful
          if (data.valid) {
            mockParseDSL(dslContent);
          }
        } else {
          // If no clear validity from server, re-parse to get local analysis
          mockParseDSL(dslContent);
        }
      }
    } catch (err: any) {
      console.error("Validation request failed:", err);
      setValidationError(
        err?.message === "Failed to fetch"
          ? "Unable to reach server. Is the backend running?"
          : String(err)
      );
    } finally {
      setValidating(false);
    }
  };

  const handleGenerateSQL = () => {
    if (selectedEngine && dslContent) {
      // Mock SQL generation - replace with actual generation logic
      setGeneratedSQL(`-- Generated SQL for ${
        engines.find((e) => e.id === selectedEngine)?.name
      }
CREATE DATABASE example_db;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10,2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Additional tables and relationships...`);
    }
  };

  // MODIFIED: Generate artifacts when user clicks Data Visualization, then navigate with artifacts in state.
  // inside CreateProject.tsx (replace only handleDataVisualization)
    const handleDataVisualization = () => {
      if (dslContent) {
        navigate("/data-visualization", {
          state: {
            projectName: projectName || "Untitled Project",
            engine: "Generic Database",
            dslContent, // for DbDocPanel
            tables: parsedData?.tables || [], // for schema view
          },
        });
      }
    };


  const handleSaveAndContinue = () => {
    // Save project logic here
    console.log("Saving project:", {
      name: projectName,
      dsl: dslContent,
      sql: generatedSQL,
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4">
          <div className="flex items-center h-16 justify-between">
            {/*Back button */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="mr-2"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </div>

            <div className="flex-1 flex justify-center px-4">
              <div className="w-full max-w-xl">
                <Input
                  placeholder="Enter project name..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full"
                  aria-label="Project name"
                />
              </div>
            </div>

            {/* Avatar + dropdown */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 w-10 rounded-full p-0"
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
          </div>
        </div>
      </header>

      {/* Three-Panel Layout */}
      <main className="container px-4 py-6">
        <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-8rem)]">
          {/* LEFT PANEL */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload DSL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload */}
                <div>
                  <label className="text-sm font-medium mb-2 block">1. Upload File</label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drop your DSL file here or
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById("file-input")?.click()}
                    >
                      Browse Files
                    </Button>
                    <input
                      id="file-input"
                      type="file"
                      accept=".yaml,.yml,.json,.dsl"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    {uploadedFile && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">📄 {uploadedFile.name}</div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Paste Code */}
                <div>
                  <label className="text-sm font-medium mb-2 block">2. Paste Code</label>
                  <Textarea
                    placeholder="Paste your DSL code here..."
                    value={dslContent}
                    onChange={(e) => setDslContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MIDDLE PANEL */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={handleValidateDSL}
                  disabled={!dslContent || validating}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {validating ? "Validating…" : "Validate DSL"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={handleDataVisualization}
                  disabled={!dslContent}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Data Visualization
                </Button>

                <Button
                  className="w-full justify-start"
                  onClick={handleSaveAndContinue}
                  disabled={!projectName || !dslContent}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save & Export
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL */}
          <div className="col-span-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parsed YAML Summary - only show after validation */}
                {(validationResult || parsedData) && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Parsed YAML Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Total Tables: {parsedData?.totalTables || 0}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Sources: {parsedData?.sources || 0}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      {(validationError || (validationResult && validationResult.valid === false)) ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Invalid DSL</span>
                        </div>
                      ) : (validationResult?.valid || parsedData?.isValid) ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Valid DSL</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Validation Pending</span>
                        </div>
                      )}
                    </div>
                    {parsedData?.tables && parsedData.tables.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tables:</p>
                        <div className="flex flex-wrap gap-1">
                          {parsedData.tables.map((table: any) => (
                            <Badge key={table.name} variant="outline" className="text-xs">
                              {table.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(validationResult || parsedData) && <Separator />}

                {/* Validation results (AJV + Referential) */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Validation Results
                  </h3>

                  {validating && <div className="text-sm text-muted-foreground">Validating...</div>}

                  {validationError && (
                    <div className="text-sm text-red-600">Error: {validationError}</div>
                  )}

                  {validationResult && (() => {
                    const { ajvErrors, referentialErrors, referentialWarnings } = normalizeValidation(validationResult);

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Valid: {String(validationResult.valid ?? validationResult.isValid ?? false)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            AJV errors: {ajvErrors?.length ?? 0}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Referential errors: {referentialErrors?.length ?? 0}
                          </Badge>
                          {referentialWarnings?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Warnings: {referentialWarnings.length}
                            </Badge>
                          )}
                        </div>

                        {/* AJV errors */}
                        {ajvErrors && ajvErrors.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">AJV Errors:</p>
                            <ul className="list-disc pl-5 text-sm">
                              {ajvErrors.map((e: any, i: number) => (
                                <li key={i}>
                                  <code>{e.instancePath || e.dataPath || "/"}</code> — {e.message || JSON.stringify(e)}
                                  {e.schemaPath ? <span className="text-muted-foreground"> ({e.schemaPath})</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Referential errors */}
                        {referentialErrors && referentialErrors.length > 0 ? (
                          <div>
                            <p className="text-sm font-medium mb-1">Referential Errors:</p>
                            <ul className="list-disc pl-5 text-sm">
                              {referentialErrors.map((e: any, i: number) => {
                                const message = typeof e === "string" ? e : e.message || e.msg || JSON.stringify(e);
                                const path = e?.path || e?.location || null;
                                return (
                                  <li key={i}>
                                    {message} {path ? <em className="text-muted-foreground">({path})</em> : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No referential errors.</div>
                        )}

                        {/* Warnings */}
                        {referentialWarnings && referentialWarnings.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">Warnings:</p>
                            <ul className="list-disc pl-5 text-sm">
                              {referentialWarnings.map((w: any, i: number) => (
                                <li key={i}>{(typeof w === "string" ? w : w.message) ?? JSON.stringify(w)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!validating && !validationError && !validationResult && (
                    <div className="text-sm text-muted-foreground">
                      Click <strong>Validate DSL</strong> to run structural (AJV) and referential validation on the server.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateProject;
