import { useState } from "react";
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
  Save
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CreateProject = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [selectedEngine, setSelectedEngine] = useState("");
  const [dslContent, setDslContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [generatedSQL, setGeneratedSQL] = useState("");

  const engines = [
    { id: "postgres", name: "PostgreSQL", icon: "🐘" },
    { id: "mysql", name: "MySQL", icon: "🐬" },
    { id: "snowflake", name: "Snowflake", icon: "❄️" },
    { id: "mongodb", name: "MongoDB", icon: "🍃" },
  ];

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDslContent(content);
      // Mock parsing - in real app, this would be actual YAML/DSL parsing
      mockParseDSL(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const mockParseDSL = (content: string) => {
    // Mock parsed data - replace with actual DSL parsing logic
    const lines = content.split('\n');
    const tableMatches = content.match(/^\s*\w+:/gm) || [];
    const columnMatches = content.match(/^\s*-\s+\w+:/gm) || [];
    
    setParsedData({
      totalTables: Math.max(tableMatches.length, 1),
      sources: Math.max(Math.floor(tableMatches.length / 3), 1),
      tables: tableMatches.map(match => match.replace(/^\s*/, '').replace(':', '')).slice(0, 10),
      relationships: Math.floor(columnMatches.filter(col => col.includes('foreign_key')).length),
      isValid: content.trim().length > 0 && !content.includes('error')
    });
  };

  const handleValidateDSL = () => {
    if (dslContent) {
      mockParseDSL(dslContent);
    }
  };

  const handleGenerateSQL = () => {
    if (selectedEngine && dslContent) {
      // Mock SQL generation - replace with actual generation logic
      setGeneratedSQL(`-- Generated SQL for ${engines.find(e => e.id === selectedEngine)?.name}
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

  const handleSaveAndContinue = () => {
    // Save project logic here
    console.log("Saving project:", {
      name: projectName,
      engine: selectedEngine,
      dsl: dslContent,
      sql: generatedSQL
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <Input
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="max-w-md"
            />
          </div>
        </div>
      </header>

      {/* Three-Panel Layout */}
      <main className="container px-4 py-6">
        <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-8rem)]">
          
          {/* LEFT PANEL - Upload DSL (25%) */}
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
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        📄 {uploadedFile.name}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Paste Code */}
                <div>
                  <label className="text-sm font-medium mb-2 block">2. Paste Code</label>
                  <Textarea
                    placeholder="Paste your DSL code here...

Example:
tables:
  users:
    columns:
      - id: integer, primary_key
      - username: varchar(255), not_null
      - email: varchar(255), unique
    
  orders:
    columns:
      - id: integer, primary_key
      - user_id: integer, foreign_key(users.id)
      - total: decimal(10,2)"
                    value={dslContent}
                    onChange={(e) => setDslContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MIDDLE PANEL - Target Engine & Actions (25%) */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Target Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Engine Selection */}
                <div className="grid grid-cols-2 gap-2">
                  {engines.map((engine) => (
                    <Button
                      key={engine.id}
                      variant={selectedEngine === engine.id ? "default" : "outline"}
                      className="h-auto p-3 flex flex-col items-center gap-1"
                      onClick={() => setSelectedEngine(engine.id)}
                    >
                      <span className="text-lg">{engine.icon}</span>
                      <span className="text-xs">{engine.name}</span>
                    </Button>
                  ))}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-3">
                  <h3 className="font-medium">Actions</h3>
                  
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={handleValidateDSL}
                    disabled={!dslContent}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Validate DSL
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={handleGenerateSQL}
                    disabled={!selectedEngine || !dslContent}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Generate SQL
                  </Button>

                  <Button
                    className="w-full justify-start"
                    onClick={handleSaveAndContinue}
                    disabled={!projectName || !selectedEngine || !dslContent}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save & Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - Preview (50%) */}
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
                      {parsedData.isValid ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Valid DSL</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Invalid DSL</span>
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

                {/* Generated SQL */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Generated SQL
                    {selectedEngine && (
                      <Badge variant="outline" className="text-xs">
                        {engines.find(e => e.id === selectedEngine)?.name}
                      </Badge>
                    )}
                  </h3>
                  {generatedSQL ? (
                    <div className="bg-muted rounded-lg p-4 max-h-[400px] overflow-auto">
                      <pre className="text-sm font-mono whitespace-pre-wrap">
                        {generatedSQL}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {selectedEngine && dslContent 
                          ? "Click 'Generate SQL' to see the preview" 
                          : "Select an engine and upload DSL to generate SQL"
                        }
                      </p>
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
