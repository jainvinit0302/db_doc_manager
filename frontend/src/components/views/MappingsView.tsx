import React from "react";
import { Map } from "lucide-react";

const MappingsView: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Map className="w-16 h-16 mx-auto text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Mappings View</h3>
          <p className="text-sm text-muted-foreground">
            Data mapping and transformation features will be implemented in future releases.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MappingsView;
