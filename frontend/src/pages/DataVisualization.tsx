import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useDSLParser } from "@/hooks/useDSLParser";
import NavigationHeader from "@/components/NavigationHeader";
import SidebarNavigation, { defaultTabs } from "@/components/SidebarNavigation";
import ContentHeader from "@/components/ContentHeader";
import { SchemaView, ERDiagramView, LineageView, MappingsView } from "@/components/views";

const DataVisualization = () => {
  const location = useLocation();
  const [lineageLevel, setLineageLevel] = useState<"table" | "column">("table");
  const [activeTab, setActiveTab] = useState("er-diagram");

  const projectData = {
    projectName: location.state?.projectName || "Untitled Project",
    engine: location.state?.engine || "Unknown Engine",
    tables: location.state?.tables || [],
    dslContent: location.state?.dslContent || "",
  };

  // Use the custom hook for DSL parsing
  const { parsedTables, lineage, loading, error, fetchLineageData } = useDSLParser(projectData.dslContent);

  // Handle tab changes and trigger API calls when needed
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    // Fetch lineage data when lineage tab is clicked
    if (tabId === "lineage" && !lineage && !loading) {
      fetchLineageData();
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "schema":
        return <SchemaView />;
      case "er-diagram":
        return <ERDiagramView parsedTables={parsedTables} />;
      case "lineage":
        return (
          <LineageView 
            lineage={lineage}
            lineageLevel={lineageLevel}
            onLevelChange={setLineageLevel}
            loading={loading}
            error={error}
            onRefresh={fetchLineageData}
          />
        );
      case "mappings":
        return <MappingsView />;
      default:
        return <ERDiagramView parsedTables={parsedTables} />;
    }
  };

  const tableCount = parsedTables.length > 0 ? parsedTables.length : (projectData.tables || []).length;

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader projectName={projectData.projectName} />

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        <SidebarNavigation 
          tabs={defaultTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <ContentHeader 
            tabs={defaultTabs}
            activeTab={activeTab}
            tableCount={tableCount}
          />
          <div className="flex-1 p-6">{renderMainContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
