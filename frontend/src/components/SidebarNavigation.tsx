import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2,
  GitBranch,
  Map,
  FileText,
} from "lucide-react";

export interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange
}) => {
  return (
    <div className="w-64 border-r border-border bg-muted/30">
      <div className="p-4">
        <h2 className="font-medium text-sm text-muted-foreground mb-4">
          VIEWS
        </h2>
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="w-4 h-4 mr-3" />
                {tab.label}
                {tab.id === "er-diagram" && activeTab === tab.id && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    ACTIVE
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

// Export default tabs configuration
export const defaultTabs: Tab[] = [
  { id: "schema", label: "Schema", icon: FileText },
  { id: "er-diagram", label: "ER Diagram", icon: Share2 },
  { id: "lineage", label: "Lineage", icon: GitBranch },
  { id: "mappings", label: "Mappings", icon: Map },
];

export default SidebarNavigation;
