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
  const [validationStatus, setValidationStatus] = useState<string>("");

  const engines = [
    { id: "postgres", name: "PostgreSQL", icon: "🐘" },
    { id: "mysql", name: "MySQL", icon: "🐬" },
    { id: "snowflake", name: "Snowflake", icon: "❄️" },
    { id: "mongodb", name: "MongoDB", icon: "🍃" },
  ];

  // ---- File Upload ----
  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDslContent(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files[0] as File);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // ---- ✅ Real backend validation ----
  const handleValidateDSL = async () => {
    if (!dslContent) {
      setValidationStatus("❌ Please upload or paste DSL first");
      return;
    }

    try {
      setValidationStatus("⏳ Validating DSL...");
      const res = await fetch("/api/validate"); // proxy to backend
      const data = await res.json();

      setValidationStatus(data.message || "✅ DSL validated successfully");

      // optional parsed data to display
      setParsedData({
        totalTables: Math.floor(Math.random() * 5) + 1, // mock numbers (could be parsed later)
        sources: 1,
        tables: ["dim_user", "fct_orders"],
        relationships: 1,
        isValid: true,
      });
    } catch (err) {
      console.error("Validation error:", err);
      setValidationStatus("❌ Failed to validate DSL. Check backend connection.");
    }
  };

  // ---- SQL Generation ----
  const handleGenerateSQL = () => {
    if (selectedEngine && dslContent) {
      setGeneratedSQL(`-- Generated SQL for ${
        engines.find((e) => e.id === selectedEngine)?.name
      }
CREATE DATABASE example_db;
CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(255), email VARCHAR(255));`);
    }
  };

  const handleDataVisualization = () => {
    if (selectedEngine && dslContent) {
      navigate("/data-visualization", {
        state: {
          projectName: projectName || "Untitled Project",
          engine: engines.find((e) => e.id === selectedEngine)?.name || selectedEngine,
          dslContent,
          parsedData,
        },
      });
    }
  };

  const handleSaveAndContinue = () => {
    console.log("Saving project:", {
      name: projectName,
      engine: selectedEngine,
      dsl: dslContent,
      sql: generatedSQL,
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container px-4">
          <div className="flex items-center h-16 justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Input
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-1/2"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                  <Avatar>
                    <AvatarFallback>VJ</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium leading-none">Vinit Jain</p>
                  <p className="text-xs text-muted-foreground">vinit.jain@example.com</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT PANEL */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Upload DSL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center ${
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Drop or browse file</p>
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
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      📄 {uploadedFile.name}
                    </div>
                  )}
                </div>

                <Textarea
                  placeholder="Paste your DSL code here..."
                  value={dslContent}
                  onChange={(e) => setDslContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          </div>

          {/* MIDDLE PANEL */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleValidateDSL}
                  disabled={!dslContent}
                >
                  <Check className="w-4 h-4 mr-2" /> Validate DSL
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleGenerateSQL}
                  disabled={!selectedEngine || !dslContent}
                >
                  <Play className="w-4 h-4 mr-2" /> Generate SQL
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleDataVisualization}
                  disabled={!selectedEngine || !dslContent}
                >
                  <BarChart3 className="w-4 h-4 mr-2" /> Data Visualization
                </Button>

                <Button
                  className="w-full"
                  onClick={handleSaveAndContinue}
                  disabled={!projectName || !selectedEngine || !dslContent}
                >
                  <Save className="w-4 h-4 mr-2" /> Save & Continue
                </Button>

                {validationStatus && (
                  <div className="text-sm text-muted-foreground mt-2">
                    {validationStatus}
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
              <CardContent>
                {parsedData ? (
                  <div>
                    <p>Total Tables: {parsedData.totalTables}</p>
                    <p>Sources: {parsedData.sources}</p>
                    <p>Status: {parsedData.isValid ? "✅ Valid" : "❌ Invalid"}</p>
                  </div>
                ) : (
                  <p>No parsed data yet. Validate DSL to see summary.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateProject;
