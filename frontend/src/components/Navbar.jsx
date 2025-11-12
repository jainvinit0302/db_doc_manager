import React from "react";

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <div className="navbar">
      <div className="brand">
        <div style={{width:38,height:38,borderRadius:8,background:"#0ea5e9",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>DB</div>
        <div>
          <div style={{fontSize:14}}>DBDocManager</div>
          <div style={{fontSize:12,color:"var(--muted)"}}>DSL → Docs / ERD / Lineage</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === "docs" ? "active":""}`} onClick={() => setActiveTab("docs")}>Docs</button>
        <button className={`tab ${activeTab === "erd" ? "active":""}`} onClick={() => setActiveTab("erd")}>ER Diagram</button>
        <button className={`tab ${activeTab === "lineage" ? "active":""}`} onClick={() => setActiveTab("lineage")}>Lineage</button>
      </div>
    </div>
  );
}
