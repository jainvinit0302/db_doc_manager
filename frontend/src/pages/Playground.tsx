import React, { useState } from "react";
import { introspectDatabase } from "../api/introspect";

// 🧩 Add these imports 👇
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";

interface IntrospectParams {
  kind: "mongodb" | "relational";
  engine?: "postgres" | "mysql" | "snowflake";
  conn: string;
  db: string;
  collection?: string;
}

export default function Playground() {
  // Explicit type: string state
  const [dbdoc, setDbdoc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function handleIntrospect(): Promise<void> {
    setLoading(true);
    try {
      const params: IntrospectParams = {
        kind: "mongodb", // change to "relational" for Postgres/MySQL introspection
        engine: "postgres",
        conn: "mongodb+srv://<username>:<password>@cluster-url", // replace with real string
        db: "shop",
        collection: "users",
      };

      const result = await introspectDatabase(params);
      setDbdoc(JSON.stringify(result, null, 2)); // display result in the editor
    } catch (err) {
      // ✅ Fix: 'err' is unknown, narrow or cast it
      if (err instanceof Error) {
        alert(`Error: ${err.message}`);
      } else {
        alert("Unexpected error: " + String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <button
        onClick={handleIntrospect}
        disabled={loading}
        className={`${
          loading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
        } text-white font-medium px-4 py-2 rounded transition`}
      >
        {loading ? "Loading..." : "Introspect DB"}
      </button>

      {/* 👇 YAML editor instead of textarea */}
      <CodeMirror
        value={dbdoc}
        height="500px"
        extensions={[yaml()]}
        onChange={(val) => setDbdoc(val)}
        className="border rounded font-mono text-sm"
      />
    </div>
  );
}
