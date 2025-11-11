// src/pages/LineageGraphPage.tsx
import React from "react";
import LineageGraph from "@/components/LineageGraph";

const LineageGraphPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Data Lineage Graph</h1>
      <LineageGraph />
    </div>
  );
};

export default LineageGraphPage;
