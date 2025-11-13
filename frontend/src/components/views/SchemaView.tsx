import React from "react";
import { FileText } from "lucide-react";

const SchemaView: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Schema View</h3>
          <p className="text-sm text-muted-foreground">
            Schema visualization and editing features will be implemented in future releases.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchemaView;
