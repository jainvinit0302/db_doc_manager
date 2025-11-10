// backend/src/cli.ts
import { Command } from "commander";
import { validateDSL } from "./parser";
import { generateDocs } from "./generator";

const program = new Command();

program
  .name("dbdoc")
  .description("DBDocManager CLI Tool")
  .version("1.0.0");

program
  .command("validate")
  .description("Validate a .dbdoc YAML file")
  .action(() => {
    console.log("🧩 Running validation...");
    validateDSL("./.dbdoc/retail_dw.yaml");
  });

program
  .command("generate")
  .description("Generate documentation and ERD")
  .action(() => {
    console.log("🧱 Generating documentation...");
    generateDocs();
  });

program.parse(process.argv);
