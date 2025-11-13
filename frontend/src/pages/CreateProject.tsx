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
  User
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

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const handleLogout = () => {
    try {
      logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Initialize state from navigation state or localStorage
  const [projectName, setProjectName] = useState(() => {
    return location.state?.projectName || 
           localStorage.getItem('dbdoc_projectName') || 
           "";
  });
  
  const [dslContent, setDslContent] = useState(() => {
    return location.state?.dslContent || 
           localStorage.getItem('dbdoc_dslContent') || 
           "";
  });
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(() => {
    // Note: Files can't be stored in localStorage, so we'll track filename only
    const savedFileName = localStorage.getItem('dbdoc_uploadedFileName');
    return savedFileName ? { name: savedFileName } as File : null;
  });
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedData, setParsedData] = useState<any>(
    location.state?.parsedData || null
  );

  // validation states
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [isValidationPassed, setIsValidationPassed] = useState(false);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (projectName) {
      localStorage.setItem('dbdoc_projectName', projectName);
    }
  }, [projectName]);

  useEffect(() => {
    if (dslContent) {
      localStorage.setItem('dbdoc_dslContent', dslContent);
      // Reset validation status when content changes (don't auto-parse)
      setIsValidated(false);
      setIsValidationPassed(false);
      setValidationResult(null);
      setValidationError(null);
      setParsedData(null); // Clear parsed data until validation is run
    }
  }, [dslContent]);

  // Clear saved state when component unmounts or navigates away
  useEffect(() => {
    return () => {
      // Only clear if we're not navigating to visualization
      if (!location.pathname.includes('/data-visualization')) {
        localStorage.removeItem('dbdoc_projectName');
        localStorage.removeItem('dbdoc_dslContent');
        localStorage.removeItem('dbdoc_uploadedFileName');
      }
    };
  }, [location.pathname]);

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
      // Don't auto-parse on file upload - wait for explicit validation
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
    try {
      if (!content || !content.trim()) {
        setParsedData(null);
        return;
      }

      // Parse actual tables from the YAML structure
      const tables: string[] = [];
      const sources: string[] = [];
      const mappings: string[] = [];

      // Extract tables from targets section
      const tablesMatch = content.match(/tables:\s*\n([\s\S]*?)(?=\n\w+:|$)/);
      if (tablesMatch) {
        const tableSection = tablesMatch[1];
        const tableNames = tableSection.match(/- name:\s*(\w+)/g) || [];
        tables.push(...tableNames.map(match => match.replace(/- name:\s*/, '')));
      }

      // Extract sources
      const sourcesMatch = content.match(/sources:\s*\n([\s\S]*?)(?=\nmappings:|$)/);
      if (sourcesMatch) {
        const sourceSection = sourcesMatch[1];
        const sourceIds = sourceSection.match(/- id:\s*(\w+)/g) || [];
        sources.push(...sourceIds.map(match => match.replace(/- id:\s*/, '')));
      }

      // Extract mappings
      const mappingsMatch = content.match(/mappings:\s*\n([\s\S]*?)(?=\nnotes:|$)/);
      if (mappingsMatch) {
        const mappingSection = mappingsMatch[1];
        const targetMappings = mappingSection.match(/- target:\s*[^\n]+/g) || [];
        mappings.push(...targetMappings.map(match => {
          const targetPath = match.replace(/- target:\s*/, '');
          const tableName = targetPath.split('.').pop() || '';
          return tableName.split('.')[0]; // Get the column name
        }));
      }

      setParsedData({
        totalTables: tables.length,
        sources: sources.length,
        tables: tables,
        mappings: mappings.length,
        relationships: 0, // Calculate from foreign keys if needed
        isValid: null, // Don't determine validity here - wait for backend validation
      });

      console.log('Parsed DSL:', { tables, sources, mappings });

    } catch (error) {
      console.error('Error parsing DSL:', error);
      setParsedData({
        totalTables: 0,
        sources: 0,
        tables: [],
        mappings: 0,
        relationships: 0,
        isValid: false,
      });
    }
  };

  // NEW: call backend /api/validate
  const handleValidateDSL = async () => {
    // quick local guard
    if (!dslContent || !dslContent.trim()) {
      setValidationError("DSL is empty. Paste or upload DSL to validate.");
      setValidationResult(null);
      setIsValidated(true);
      setIsValidationPassed(false);
      setParsedData(null);
      return;
    }

    setValidating(true);
    setValidationResult(null);
    setValidationError(null);

    // Parse DSL first for local preview
    mockParseDSL(dslContent);

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
        // server returned an HTTP error
        const msg =
          (data && data.error) ||
          (data && JSON.stringify(data)) ||
          `Server error ${res.status}`;
        setValidationError(String(msg));
        setValidationResult(null);
        setIsValidated(true);
        setIsValidationPassed(false);
        // Update parsed data to reflect failed validation
        setParsedData((prev: any) => ({ ...(prev || {}), isValid: false }));
      } else {
        // successful response
        setValidationResult(data);
        setIsValidated(true);

        // Check if validation passed
        const isValid = data?.valid === true;
        setIsValidationPassed(isValid);

        // one-time debug to inspect raw shape
        // eslint-disable-next-line no-console
        console.debug("Validation result (raw):", data);

        // update parsedData validity indicator with authoritative result if available
        if (data && typeof data.valid === "boolean") {
          setParsedData((prev: any) => ({ ...(prev || {}), isValid: data.valid }));
        }
      }
    } catch (err: any) {
      console.error("Validation request failed:", err);
      setValidationError(
        err?.message === "Failed to fetch"
          ? "Unable to reach server. Is the backend running?"
          : String(err)
      );
      setIsValidated(true);
      setIsValidationPassed(false);
      // Update parsed data to reflect failed validation
      setParsedData((prev: any) => ({ ...(prev || {}), isValid: false }));
    } finally {
      setValidating(false);
    }
  };

  const handleDataVisualization = () => {
    if (dslContent) {
      try {
        // Simple validation
        if (!dslContent.includes("tables:") || !dslContent.includes("name:")) {
          setValidationError("Invalid DSL format. Please ensure it contains tables with names.");
          return;
        }

        // Parse the DSL content
        const parsed = mockParseDSL(dslContent);
        setParsedData(parsed);

        // Save current state and navigate
        const navigationState = {
          projectName: projectName || "Untitled Project",
          engine: "PostgreSQL",
          dslContent,
          parsedData: parsed,
          uploadedFileName: uploadedFile?.name
        };

        // Clear localStorage since we're passing via navigation state
        localStorage.removeItem('dbdoc_projectName');
        localStorage.removeItem('dbdoc_dslContent'); 
        localStorage.removeItem('dbdoc_uploadedFileName');

        // Navigate with state
        navigate("/data-visualization", { state: navigationState });
      } catch (error) {
        console.error("Error parsing DSL content:", error);
        setValidationError("Error parsing DSL content. Please check the format.");
      }
    }
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
                  disabled={!dslContent || !isValidated || !isValidationPassed}
                  title={
                    !dslContent 
                      ? "Please provide DSL content first"
                      : !isValidated 
                      ? "Please validate the DSL first"
                      : !isValidationPassed
                      ? "DSL validation failed. Please fix errors and validate again"
                      : "Generate data visualization"
                  }
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Data Visualization
                </Button>
                
                {/* Validation Status Indicator */}
                {dslContent && isValidated && (
                  <div className="text-xs text-center mt-2">
                    {isValidationPassed ? (
                      <span className="text-green-600 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" />
                        Validation passed - Ready to visualize
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Validation failed - Fix errors first
                      </span>
                    )}
                  </div>
                )}
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
                    <div className="flex items-center gap-2 mb-4">
                      {parsedData.isValid === true ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Valid DSL</span>
                        </div>
                      ) : parsedData.isValid === false ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Invalid DSL</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Validation pending</span>
                        </div>
                      )}
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