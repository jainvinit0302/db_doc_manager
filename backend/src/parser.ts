// backend/src/parser.ts
import * as fs from "fs";
import * as yaml from "yaml";

export function validateDSL(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const data = yaml.parse(content);

  console.log("✅ DSL parsed successfully!");
  console.log(`📄 Project: ${data.project || "Unnamed"}`);
}
