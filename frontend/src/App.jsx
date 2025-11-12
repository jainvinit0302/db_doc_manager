import React, { useState } from "react";
import Navbar from "./components/Navbar.jsx";
import DslEditor from "./components/DslEditor.jsx";
import ConversionPanel from "./components/ConversionPanel.jsx";
import ERDiagram from "./components/ERDiagram.jsx";
import LineageGraph from "./components/LineageGraph.jsx";
import axios from "axios";

/*
  App manages tab state and provides parsed/normalized data to children.
*/

export default function App() {
  const [activeTab, setActiveTab] = useState("docs"); // docs | erd | lineage
  const [yamlText, setYamlText] = useState(sampleYaml());
  const [parsed, setParsed] = useState(null);
  const [normalized, setNormalized] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleParseValidate(text) {
    setLoading(true);
    setError(null);
    setParsed(null);
    setNormalized(null);
    try {
      const res = await axios.post("/api/parse-validate", text, {
        headers: { "Content-Type": "text/plain" },
        timeout: 4000
      });
      setParsed(res.data.parsed);
      setNormalized(res.data.normalized);
    } catch (err) {
      // fallback to mock demo if server not reachable
      console.warn("Backend parse error, using demo:", err?.message || err);
      const demo = demoNormalized();
      setParsed(demo.raw);
      setNormalized(demo.normalized);
      setError("Backend not available — showing demo output.");
    } finally {
      setLoading(false);
      setActiveTab("docs");
    }
  }

  return (
    <div className="app">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="layout">
        <div className="panel">
          <h3>DSL Editor</h3>
          <DslEditor
            value={yamlText}
            onChange={setYamlText}
            onParse={() => handleParseValidate(yamlText)}
            loading={loading}
          />
          <div className="bottom-panels">
            <div>
              <h4 style={{marginBottom:8}}>Conversion & Validation</h4>
              <ConversionPanel parsed={parsed} normalized={normalized} error={error} />
            </div>
            <div>
              <h4 style={{marginBottom:8}}>Quick Preview</h4>
              <div className="result-pre">
                <strong>Normalized (JSON)</strong>
                <pre style={{whiteSpace:"pre-wrap"}}>{normalized ? JSON.stringify(normalized, null, 2) : "No output yet"}</pre>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          {activeTab === "docs" && <div>
            <h3>Docs & Conversions</h3>
            <p style={{color:"var(--muted)"}}>Select the tabs at top to view ERD or Lineage.</p>
            <div style={{marginTop:10}}>
              <ConversionPanel parsed={parsed} normalized={normalized} error={error} showFull />
            </div>
          </div>}
          {activeTab === "erd" && <ERDiagram normalized={normalized} />}
          {activeTab === "lineage" && <LineageGraph normalized={normalized} />}
        </div>
      </div>
    </div>
  );
}

// sample starter YAML
function sampleYaml(){
  return `project: retail_dw
targets:
  - db: dw
    schema: mart
    tables:
      - name: dim_user
        description: "Master user dimension"
        columns:
          - { name: user_id, type: INTEGER, pk: true }
          - { name: email, type: VARCHAR(320) }
          - { name: address_street, type: VARCHAR(256) }
  - db: dw
    schema: mart
    tables:
      - name: fct_order_line
        columns:
          - { name: order_id, type: STRING }
          - { name: line_nbr, type: INT }
          - { name: sku, type: STRING }
sources:
  - id: mongo_users
    kind: mongodb
    db: shop
    collection: users
  - id: mongo_orders
    kind: mongodb
    db: shop
    collection: orders
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
  - target: dw.mart.fct_order_line.*
    from:
      source_id: mongo_orders
      path: $.lines[*]
      fields:
        order_id: $.order_id
        line_nbr: $index
        sku: $.sku
        qty: $.quantity
`;
}

// demo normalized output used if backend not reachable
function demoNormalized(){
  const raw = { demo: true };
  const normalized = {
    targets: [
      { fullName: "dw.mart.dim_user", columns: ["user_id","email","address_street"] },
      { fullName: "dw.mart.fct_order_line", columns: ["order_id","line_nbr","sku","qty"] }
    ],
    mappings: [
      { target: "dw.mart.dim_user.email", source: "mongo_users", path: "$.contact.email", transform: "lower()", validTarget: true },
      { target: "dw.mart.dim_user.address_street", source: "mongo_users", path: "$.address.street", transform: null, validTarget: true },
      { target: "dw.mart.fct_order_line.order_id", source: "mongo_orders", path: "$.lines[*].order_id", transform: null, validTarget: true },
      { target: "dw.mart.fct_order_line.sku", source: "mongo_orders", path: "$.lines[*].sku", transform: null, validTarget: true }
    ]
  };
  return { raw, normalized };
}
