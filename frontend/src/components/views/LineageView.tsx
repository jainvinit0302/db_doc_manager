import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LineageGraph from "@/components/LineageGraph";
import { GitBranch, RefreshCw } from "lucide-react";

interface LineageViewProps {
  lineage: any;
  lineageLevel: "table" | "column";
  onLevelChange: (level: "table" | "column") => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const LineageView: React.FC<LineageViewProps> = ({
  lineage,
  lineageLevel,
  onLevelChange,
  loading = false,
  error = null,
  onRefresh
}) => {
  return (
    <div className="w-full h-full p-6">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Data Lineage</h3>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={
                  lineageLevel === "table" ? "secondary" : "outline"
                }
                onClick={() => onLevelChange("table")}
              >
                Table-level
              </Button>
              <Button
                size="sm"
                variant={
                  lineageLevel === "column" ? "secondary" : "outline"
                }
                onClick={() => onLevelChange("column")}
              >
                Column-level
              </Button>
              {onRefresh && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {lineage
                ? `${lineage.nodes?.length || 0} nodes • ${
                    (lineage.edges?.length || 0) + (lineage.table_edges?.length || 0)
                  } edges`
                : "No data loaded"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[500px]">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
              <div className="text-center space-y-4">
                <GitBranch className="w-16 h-16 mx-auto animate-pulse" />
                <div>
                  <h3 className="text-lg font-medium">Loading Lineage Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Fetching data lineage from server...
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-red-200">
              <div className="text-center space-y-4">
                <GitBranch className="w-16 h-16 mx-auto text-red-400" />
                <div>
                  <h3 className="text-lg font-medium text-red-600">Error Loading Lineage</h3>
                  <p className="text-sm text-red-500 max-w-md">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          ) : lineage ? (
            <LineageGraph lineage={lineage} level={lineageLevel} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
              <div className="text-center space-y-4">
                <GitBranch className="w-16 h-16 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium">No Data Lineage Loaded</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    Click the button below to fetch data lineage from your DSL configuration.
                  </p>
                  {onRefresh && (
                    <Button onClick={onRefresh} variant="outline">
                      <GitBranch className="w-4 h-4 mr-2" />
                      Load Lineage Data
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LineageView;
