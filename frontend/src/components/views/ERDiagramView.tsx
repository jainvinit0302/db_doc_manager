import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Table } from "lucide-react";

interface ParsedTable {
  name: string;
  columns: string[];
}

interface ERDiagramViewProps {
  parsedTables: ParsedTable[];
}

const ERDiagramView: React.FC<ERDiagramViewProps> = ({ parsedTables }) => {
  return (
    <div className="w-full h-full p-6">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Entity Relationship Diagram</h3>
        </div>

        <div className="flex-1 min-h-[500px]">
          {parsedTables.length > 0 ? (
            <div className="h-full overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {parsedTables.map((table) => (
                  <Card key={`parsed-${table.name}`} className="hover:shadow-lg transition-shadow border-2">
                    <CardHeader className="pb-3 bg-primary/5">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Table className="w-5 h-5 text-primary" />
                        {table.name}
                      </CardTitle>
                      <Badge variant="secondary" className="w-fit text-xs">
                        {(table.columns || []).length} columns
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <div className="space-y-2">
                        {(table.columns || []).map((column: string, index: number) => (
                          <div
                            key={`parsed-${table.name}-col-${index}`}
                            className="text-sm flex items-center gap-2 p-2 bg-muted/30 rounded"
                          >
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <span className="font-mono text-xs">{column}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
              <div className="text-center space-y-4">
                <Database className="w-16 h-16 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium">No ERD Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Upload DSL content on the project page and navigate here to view the Entity Relationship Diagram.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ERDiagramView;
