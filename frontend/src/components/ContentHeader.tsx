import React from "react";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import { Tab } from "@/components/SidebarNavigation";

interface ContentHeaderProps {
  tabs: Tab[];
  activeTab: string;
  tableCount: number;
}

const ContentHeader: React.FC<ContentHeaderProps> = ({
  tabs,
  activeTab,
  tableCount
}) => {
  const currentTab = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="p-6 border-b border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {currentTab?.label || "Unknown View"}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <Database className="w-3 h-3 mr-1" />
            {tableCount} tables
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default ContentHeader;
