// frontend/src/App.jsx - FULLY CORRECTED
import React, { useState, useEffect } from "react";
import { Play, AlertCircle, CheckCircle } from "lucide-react";

// Import all components
import Navbar from "./components/Navbar.jsx";
import DslEditor from "./components/DslEditor.jsx";
import ConversionPanel from "./components/ConversionPanel.jsx";
import ERDiagram from "./components/ERDiagram.jsx";
import LineageGraph from "./components/LineageGraph.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Correct API base URL
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

// Default YAML sample
const DEFAULT_YAML = `project: retail_dw
owners: [ "data-eng@company.com" ]
targets:
  - db: dw
    engine: postgres
    schema: mart
    tables:
      - name: dim_user
        description: Master user dimension
        columns:
          - { name: user_id, type: INTEGER, pk: true, description: Surrogate key }
          - { name: email, type: VARCHAR(320), unique: true, not_null: true }
          - { name: address_street, type: VARCHAR(256) }
          - { name: created_at, type: TIMESTAMP, default: now() }
sources:
  - id: mongo_users
    kind: mongodb
    conn: atlas-cluster-A
    db: shop
    collection: users
mappings:
  - target: dw.mart.dim_user.email
    from:
      source_id: mongo_users
      path: $.contact.email
      transform: lower()
  - target: dw.mart.dim_user.address_street
    from:
      source_id: mongo_users
      path: $.address.street
  - target: dw.mart.dim_user.user_id
    from:
      rule: sequence('dim_user_seq')`;

export default function App() {
  const [yamlInput, setYamlInput] = useState("");
  const [activeTab, setActiveTab] = useState("docs");
  const [validationResult, setValidationResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("dbdoc-yaml");
    if (saved) {
      setYamlInput(saved);
    } else {
      setYamlInput(DEFAULT_YAML);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (yamlInput) {
      localStorage.setItem("dbdoc-yaml", yamlInput);
    }
  }, [yamlInput]);

  // Handle form submission
  async function handleProcess() {
    setLoading(true);
    setValidationResult(null);

    try {
      const res = await fetch(`${API_BASE}/dbdoc/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: yamlInput }),
      });

      const data = await res.json();

      if (data.success) {
        setProcessedData(data.data);
        setValidationResult({
          type: "success",
          message: "Validation passed successfully!",
          warnings: data.warnings || [],
        });
        setActiveTab("docs");
      } else {
        setValidationResult({
          type: "error",
          message: "Validation failed",
          errors: data.errors || ["Unknown error occurred"],
        });
        setProcessedData(null);
      }
    } catch (err) {
      console.error("API Error:", err);
      setValidationResult({
        type: "error",
        message: "Backend connection error",
        errors: [
          err.message,
          "Make sure backend is running on http://localhost:3001",
        ],
      });
      setProcessedData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="layout">
          {/* Left Panel: Editor */}
          <div className="panel">
            <DslEditor value={yamlInput} onChange={setYamlInput} />
            
            <button
              className="btn"
              onClick={handleProcess}
              disabled={loading}
              style={{
                marginTop: 12,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <Play size={18} />
                  Process & Validate
                </>
              )}
            </button>

            {/* Validation Results */}
            {validationResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor:
                    validationResult.type === "success"
                      ? "#10b981"
                      : "#ef4444",
                  background:
                    validationResult.type === "success"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                  {validationResult.type === "success" ? (
                    <CheckCircle size={20} style={{ color: "#10b981", flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={20} style={{ color: "#ef4444", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <strong
                      style={{
                        color:
                          validationResult.type === "success"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {validationResult.message}
                    </strong>

                    {validationResult.errors &&
                      validationResult.errors.length > 0 && (
                        <ul
                          style={{
                            margin: "8px 0 0 0",
                            paddingLeft: 20,
                            fontSize: 13,
                            color: "#fca5a5",
                          }}
                        >
                          {validationResult.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      )}

                    {validationResult.warnings &&
                      validationResult.warnings.length > 0 && (
                        <ul
                          style={{
                            margin: "8px 0 0 0",
                            paddingLeft: 20,
                            fontSize: 13,
                            color: "#fbbf24",
                          }}
                        >
                          {validationResult.warnings.map((warn, idx) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Output based on active tab */}
          <div className="panel">
            <ErrorBoundary>
              {activeTab === "docs" && (
                <ConversionPanel processedData={processedData} />
              )}
              {activeTab === "erd" && (
                <ERDiagram processedData={processedData} />
              )}
              {activeTab === "lineage" && (
                <LineageGraph processedData={processedData} />
              )}
            </ErrorBoundary>
          </div>
        </div>

        <footer
          style={{
            marginTop: 20,
            padding: 12,
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13,
            borderTop: "1px solid var(--border)",
          }}
        >
          <p style={{ margin: 0 }}>
            DBDocManager v1.0.0 | Team Size: 5 |{" "}
            <a
              href="mailto:saianirudh.karre@iiit.ac.in"
              style={{ color: "#0ea5e9" }}
            >
              saianirudh.karre@iiit.ac.in
            </a>
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}