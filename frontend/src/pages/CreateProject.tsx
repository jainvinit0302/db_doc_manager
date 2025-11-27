// src/pages/CreateProject.tsx
import React, { useState, useEffect } from "react";
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
  BarChart3,
  LogOut,
  User,
  Edit,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { useProject, useProjectActions } from "@/contexts/ProjectContext";

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // Get project state from context
  const {
    projectId,
    projectName,
    dslContent,
    isEditing,
    isValidated,
    isValidationPassed,
    validationResult,
    validationError: contextValidationError,
    parsedData,
    isDirty,
  } = useProject();

  // Get context actions
  const {
    updateProjectName,
    updateDSL,
    setEditing,
    saveValidation,
    markSaved,
    resetProject,
  } = useProjectActions();

  // Handle default name from navigation state (for new projects)
  useEffect(() => {
    if (location.state?.defaultName && !projectId && !projectName) {
      updateProjectName(location.state.defaultName);
      setEditing(true); // New projects start in edit mode
    }
  }, [location.state]);

  // Local UI state (not part of global context)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogout = () => {
    try {
      logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // File upload handler
  const handleFileUpload = (file: File) => {
    if (projectId && !isEditing) return; // Prevent upload in read-only mode
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      updateDSL(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (projectId && !isEditing) return;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0] as File);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (projectId && !isEditing) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Lightweight client-side parse for preview
  const mockParseDSL = (content: string) => {
    try {
      if (!content || !content.trim()) return null;

      const tables: string[] = [];
      const sources: string[] = [];
      const mappings: string[] = [];

      const tablesMatch = content.match(/tables:\s*\n([\s\S]*?)(?=\n\w+:|$)/);
      if (tablesMatch) {
        const tableSection = tablesMatch[1];
        const tableNames = tableSection.match(/- name:\s*(\w+)/g) || [];
        tables.push(...tableNames.map(match => match.replace(/- name:\s*/, '')));
      }

      const sourcesMatch = content.match(/sources:\s*\n([\s\S]*?)(?=\nmappings:|$)/);
      if (sourcesMatch) {
        const sourceSection = sourcesMatch[1];
        const sourceIds = sourceSection.match(/- id:\s*(\w+)/g) || [];
        sources.push(...sourceIds.map(match => match.replace(/- id:\s*/, '')));
      }

      const mappingsMatch = content.match(/mappings:\s*\n([\s\S]*?)(?=\nnotes:|$)/);
      if (mappingsMatch) {
        const mappingSection = mappingsMatch[1];
        const targetMappings = mappingSection.match(/- target:\s*[^\n]+/g) || [];
        mappings.push(...targetMappings.map(match => {
          const targetPath = match.replace(/- target:\s*/, '');
          return targetPath.split('.').pop() || targetPath;
        }));
      }

      return {
        totalTables: tables.length,
        sources: sources.length,
        tables,
        mappings: mappings.length,
        relationships: 0,
      };
    } catch (error) {
      console.error('Error parsing DSL:', error);
      return null;
    }
  };

  // Validate DSL
  const handleValidateDSL = async () => {
    if (!dslContent || !dslContent.trim()) {
      saveValidation({
        isValidated: true,
        isValidationPassed: false,
        validationResult: null,
        validationError: "DSL is empty. Paste or upload DSL to validate.",
        parsedData: null,
      });
      return;
    }

    setValidating(true);
    const mockData = mockParseDSL(dslContent);

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "text/yaml; charset=utf-8" },
        body: dslContent,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (data && data.error) || `Server error ${res.status}`;
        saveValidation({
          isValidated: true,
          isValidationPassed: false,
          validationResult: null,
          validationError: String(msg),
          parsedData: mockData,
        });
      } else {
        const isValid = data?.valid === true;
        saveValidation({
          isValidated: true,
          isValidationPassed: isValid,
          validationResult: data,
          validationError: null,
          parsedData: mockData,
        });
      }
    } catch (err: any) {
      saveValidation({
        isValidated: true,
        isValidationPassed: false,
        validationResult: null,
        validationError: err?.message === "Failed to fetch"
          ? "Unable to reach server. Is the backend running?"
          : String(err),
        parsedData: mockData,
      });
    } finally {
      setValidating(false);
    }
  };

  // Data Visualization button handler
  const handleDataVisualization = async () => {
    if (!dslContent || !dslContent.trim()) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: "DSL is empty. Paste or upload DSL to generate artifacts.",
      });
      return;
    }

    if (!isValidated || !isValidationPassed) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: "Please validate the DSL and ensure it passes before generating visualization.",
      });
      return;
    }

    setValidating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "text/yaml; charset=utf-8" },
        body: dslContent,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = (data && (data.error || JSON.stringify(data))) || `Server generate failed: ${res.status}`;
        saveValidation({
          ...{ isValidated, isValidationPassed, validationResult, parsedData },
          validationError: String(message),
        });
        setValidating(false);
        return;
      }

      const artifacts = {
        csv: data.csv || "",
        mermaids: Array.isArray(data.mermaids) ? data.mermaids : [],
        lineage: data.lineage || null,
        referentialWarnings: data.referentialWarnings || [],
      };

      // Navigate to DataVisualization
      navigate("/data-visualization", {
        state: {
          projectName: projectName || "Untitled Project",
          projectId,
          isEditing,
          engine: "Postgres",
          dslContent,
          parsedData,
          artifacts,
        },
      });
    } catch (err: any) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: err?.message === "Failed to fetch"
          ? "Unable to reach server. Is the backend running?"
          : String(err),
      });
    } finally {
      setValidating(false);
    }
  };

  // Save Project to Database
  const handleSaveProject = async () => {
    if (!projectName || !projectName.trim()) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: "Please enter a project name before saving.",
      });
      return;
    }

    if (!dslContent || !dslContent.trim()) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: "Please provide DSL content before saving.",
      });
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        saveValidation({
          ...{ isValidated, isValidationPassed, validationResult, parsedData },
          validationError: "You must be logged in to save projects.",
        });
        setSaving(false);
        return;
      }

      const url = projectId ? `/api/projects/${projectId}` : "/api/projects";
      const method = projectId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          dslContent: dslContent,
          metadata: {
            isValidated,
            isValidationPassed,
            validationResult,
            parsedData,
            lastValidated: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        saveValidation({
          ...{ isValidated, isValidationPassed, validationResult, parsedData },
          validationError: data.error || "Failed to save project",
        });
        setSaving(false);
        return;
      }

      // Success! Mark as saved and return to read-only mode
      markSaved();
      alert(`Project "${projectName}" saved successfully!`);
      navigate("/dashboard");
    } catch (err: any) {
      saveValidation({
        ...{ isValidated, isValidationPassed, validationResult, parsedData },
        validationError: err?.message === "Failed to fetch"
          ? "Unable to reach server. Is the backend running?"
          : "Failed to save project. Please try again.",
      });
      setSaving(false);
    }
  };

  // Cancel edit mode - discard changes
  const handleCancelEdit = () => {
    if (isDirty && !confirm("Discard unsaved changes?")) {
      return;
    }
    setEditing(false);
    // Could reload from server here if needed
  };

  // Normalize validation for display
  const normalizeValidation = (vr: any) => {
    if (!vr) return { ajvErrors: [], referentialErrors: [], referentialWarnings: [] };

    const ajvErrors = vr.ajvErrors || vr.ajv_errors || [];
    const referentialErrors = vr.referentialErrors || vr.referential?.errors || [];
    const referentialWarnings = vr.referentialWarnings || vr.referential?.warnings || [];

    return { ajvErrors, referentialErrors, referentialWarnings };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4">
          <div className="flex items-center h-16 justify-between">
            {/* Back button */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) {
                    return;
                  }
                  navigate("/dashboard");
                }}
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
                  onChange={(e) => updateProjectName(e.target.value)}
                  className="w-full"
                  aria-label="Project name"
                  disabled={!!projectId && !isEditing}
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
          {/* LEFT PANEL - Upload DSL */}
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
                <div className={(projectId && !isEditing) ? "opacity-50 pointer-events-none" : ""}>
                  <label className="text-sm font-medium mb-2 block">1. Upload File</label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
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
                  <label className="text-sm font-medium mb-2 flex items-center justify-between">
                    2. Paste Code
                    {projectId && !isEditing && <Badge variant="secondary" className="text-xs">Read-only</Badge>}
                    {projectId && isEditing && <Badge variant="default" className="text-xs">Editing</Badge>}
                    {isDirty && <Badge variant="destructive" className="text-xs">Unsaved</Badge>}
                  </label>
                  <Textarea
                    placeholder="Paste your DSL code here..."
                    value={dslContent}
                    onChange={(e) => updateDSL(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    disabled={!!projectId && !isEditing}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MIDDLE PANEL - Actions */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Validation Status Display - Shows in sidebar */}
                {isValidated && (
                  <div className={`p-3 rounded-lg border ${isValidationPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {isValidationPassed ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${isValidationPassed ? 'text-green-800' : 'text-red-800'}`}>
                        {isValidationPassed ? 'Validation Passed' : 'Validation Failed'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isValidationPassed
                        ? 'Ready for visualization and deployment'
                        : 'Please fix errors before proceeding'}
                    </p>
                  </div>
                )}

                {/* Show Edit button ONLY if existing project AND not editing */}
                {projectId && !isEditing && (
                  <Button
                    variant="default"
                    className="w-full justify-start"
                    onClick={() => setEditing(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Project
                  </Button>
                )}

                {/* Show Validate, Save, Cancel buttons if new project OR editing */}
                {(!projectId || isEditing) && (
                  <>
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
                      variant="default"
                      className="w-full justify-start"
                      onClick={handleSaveProject}
                      disabled={!projectName || !dslContent || saving || validating || !isDirty}
                      title={
                        !projectName
                          ? "Please enter a project name"
                          : !dslContent
                            ? "Please provide DSL content"
                            : !isDirty
                              ? "No changes to save"
                              : "Save project to database"
                      }
                    >
                      <Database className="w-4 h-4 mr-2" />
                      {saving ? "Saving…" : (projectId ? "Update Project" : "Save Project")}
                    </Button>

                    {projectId && isEditing && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleCancelEdit}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </>
                )}

                {/* Data Visualization button - Show for valid projects (even in read-only) */}
                {isValidated && isValidationPassed && (
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={handleDataVisualization}
                    disabled={!dslContent || validating}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {validating ? "Generating…" : "Data Visualization"}
                  </Button>
                )}

                {/* Help text for when validation is needed */}
                {!isValidated && dslContent && (!projectId || isEditing) && (
                  <div className="text-xs text-center text-muted-foreground p-2 bg-muted/50 rounded">
                    Click "Validate DSL" to check for errors
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - Preview */}
          <div className="col-span-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parsed YAML Summary */}
                {parsedData && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Parsed YAML Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Total Tables: {parsedData.totalTables}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Sources: {parsedData.sources}</Badge>
                      </div>
                    </div>

                    {parsedData.tables && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tables:</p>
                        <div className="flex flex-wrap gap-1">
                          {parsedData.tables.map((table: string) => (
                            <Badge key={table} variant="outline" className="text-xs">
                              {table}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Validation results */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Validation Results
                  </h3>

                  {validating && <div className="text-sm text-muted-foreground">Working...</div>}

                  {contextValidationError && (
                    <div className="text-sm text-red-600">Error: {contextValidationError}</div>
                  )}

                  {validationResult && (() => {
                    const { ajvErrors, referentialErrors, referentialWarnings } = normalizeValidation(validationResult);

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Valid: {String(validationResult.valid ?? false)}
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

                  {!validating && !contextValidationError && !validationResult && (
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
