// backend/src/cli.ts
import path from "path";
import fs from "fs";
import process from "process";
import YAML from "js-yaml";

import { loadDbdocFiles, validateStructure, normalize } from "./parser";
import { referentialValidate } from "./validator";
import { writeMappingCSV, generateMermaidERD, generateLineageJSON } from "./generator";

/**
 * Minimal arg parser (no external dependency)
 */
function parseArgs() {
  const raw = process.argv.slice(2);
  const result: any = { _: [] as string[] };
  let i = 0;
  while (i < raw.length) {
    const token = raw[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else if (token.startsWith("-")) {
      const key = token.slice(1);
      const next = raw[i + 1];
      if (next && !next.startsWith("-")) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      result._.push(token);
      i++;
    }
  }
  return result;
}

function usage() {
  console.log(`Usage: node dist/cli.js <command> --dir <dbdoc-dir> [--out <out-dir>]
Commands:
  validate --dir <dbdoc-dir>                 Validate dbdoc files
  generate --dir <dbdoc-dir> --out <out-dir> Generate artifacts (CSV, ERD, lineage)
`);
}

/**
 * Safe YAML parse: returns the first document object if YAML returns an array,
 * or returns the object directly. Throws if the result is not an object.
 */
function safeLoadYamlObject(raw: string, sourcePath = "<input>"): any {
  const parsed = YAML.load(raw) as any;
  if (Array.isArray(parsed)) {
    // pick the first non-empty object in multi-doc YAML
    const firstObj = parsed.find((d) => d && typeof d === "object");
    if (!firstObj) {
      throw new Error(`YAML parse for ${sourcePath} returned an array but contained no object documents.`);
    }
    return firstObj;
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `YAML parse for ${sourcePath} returned a ${parsed === null ? "null" : typeof parsed} — expected an object at root.`
    );
  }
  return parsed;
}

/**
 * Validate command: checks each file with AJV + referential validator
 */
async function cmdValidate(dir: string) {
  if (!dir) {
    console.error("Missing --dir");
    usage();
    process.exit(2);
  }

  const files = loadDbdocFiles(dir) as any[];

  if (!files || files.length === 0) {
    console.error("No dbdoc files found in", dir);
    process.exit(3);
  }

  let overallValid = true;

  for (const f of files) {
    try {
      // --- robustly obtain parsed object from loader result ---
      // loader may return { parsed, raw } or { path, content } etc.
      let parsed: any = undefined;

      // prefer loader's parsed if present and is object
      if (f && f.parsed && typeof f.parsed === "object") {
        parsed = f.parsed;
      } else if (f && typeof f.raw === "string") {
        // attempt to parse the raw YAML text
        try {
          parsed = safeLoadYamlObject(f.raw, f.path);
        } catch (e: any) {
          console.error(`${f.path}: YAML parse/shape error: ${e.message}`);
          overallValid = false;
          continue;
        }
      } else if (f && typeof f.content === "string") {
        try {
          parsed = safeLoadYamlObject(f.content, f.path);
        } catch (e: any) {
          console.error(`${f.path}: YAML parse/shape error: ${e.message}`);
          overallValid = false;
          continue;
        }
      } else {
        console.error(`${f.path || '<unknown>'}: unsupported file entry shape from loader: ${JSON.stringify(Object.keys(f))}`);
        overallValid = false;
        continue;
      }

      // --- proceed with validation using `parsed` object ---
      const ajvResult = validateStructure(parsed);
      const ajvValid = ajvResult.valid;
      const ajvErrors = ajvResult.errors || [];

      const aggregated = {
        targets: parsed.targets || [],
        sources: parsed.sources || [],
        mappings: parsed.mappings || [],
      };
      const ast = normalize(aggregated);
      const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

      const valid = ajvValid && (!refErrors || refErrors.length === 0);
      if (!valid) {
        overallValid = false;
        console.error(`${f.path}: INVALID`);
        console.error("  ajvValid:", ajvValid);
        if (ajvErrors && ajvErrors.length) console.error("  ajvErrors:", JSON.stringify(ajvErrors, null, 2));
        if (refErrors && refErrors.length) console.error("  referentialErrors:", JSON.stringify(refErrors, null, 2));
        if (refWarnings && refWarnings.length) console.warn("  referentialWarnings:", JSON.stringify(refWarnings, null, 2));
      } else {
        console.log(`${f.path}: OK`);
      }
    } catch (err: any) {
      overallValid = false;
      console.error(`${f.path}: parse/validation error:`, err.message || err);
    }
  }

  if (!overallValid) process.exit(4);
  process.exit(0);
}

/**
 * Generate command: merges files into a combined AST and emits artifacts to outDir
 */
async function cmdGenerate(dir: string, outDir: string) {
  if (!dir) {
    console.error("Missing --dir");
    usage();
    process.exit(2);
  }
  outDir = outDir || path.resolve(process.cwd(), "docs");

  const files = loadDbdocFiles(dir) as any[];
  if (!files || files.length === 0) {
    console.error("No dbdoc files found in", dir);
    process.exit(3);
  }

  // Aggregate parsed content across files
  const aggregatedTargets: any[] = [];
  const aggregatedSources: any[] = [];
  const aggregatedMappings: any[] = [];

  for (const f of files) {
    let parsed: any;
    // Accept loader-provided parsed, or parse raw/content
    if (f && f.parsed && typeof f.parsed === "object") {
      parsed = f.parsed;
    } else if (f && typeof f.raw === "string") {
      try {
        parsed = safeLoadYamlObject(f.raw, f.path);
      } catch (e: any) {
        console.error("YAML parse error in", f.path, String(e.message || e));
        process.exit(5);
      }
    } else if (f && typeof f.content === "string") {
      try {
        parsed = safeLoadYamlObject(f.content, f.path);
      } catch (e: any) {
        console.error("YAML parse error in", f.path, String(e.message || e));
        process.exit(5);
      }
    } else {
      console.error(`${f.path || '<unknown>'}: unsupported file entry shape from loader: ${JSON.stringify(Object.keys(f))}`);
      process.exit(5);
    }

    aggregatedTargets.push(...(parsed.targets || []));
    aggregatedSources.push(...(parsed.sources || []));
    aggregatedMappings.push(...(parsed.mappings || []));
  }

  const aggregated = { targets: aggregatedTargets, sources: aggregatedSources, mappings: aggregatedMappings };
  const ast = normalize(aggregated);
  const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);
  let firstParsed: any = null;
  const firstFileWithParsed = files.find((f:any) => f && f.parsed && typeof f.parsed === "object");
  if (firstFileWithParsed) firstParsed = firstFileWithParsed.parsed;
  else if (files.length > 0) {
    // fallback: try to parse the first file's raw/content to extract metadata
    const f0: any = files[0];
    try {
      if (f0 && typeof f0.raw === "string") firstParsed = safeLoadYamlObject(f0.raw, f0.path);
      else if (f0 && typeof f0.content === "string") firstParsed = safeLoadYamlObject(f0.content, f0.path);
    } catch {
      firstParsed = null;
    }
  }

  // Compose root object for AJV validation
  const rootObj: any = {
    targets: aggregatedTargets,
    sources: aggregatedSources,
    mappings: aggregatedMappings,
  };

  // copy common top-level metadata if present
  if (firstParsed && typeof firstParsed === "object") {
    if (firstParsed.project) rootObj.project = firstParsed.project;
    if (firstParsed.version) rootObj.version = firstParsed.version;
    if (firstParsed.owners) rootObj.owners = firstParsed.owners;
    if (firstParsed.tags) rootObj.tags = firstParsed.tags;
  }

  const ajvResult = validateStructure(rootObj);
  const ajvValid = ajvResult.valid;
  const ajvErrors = ajvResult.errors || [];

  if (!ajvValid || (refErrors && refErrors.length > 0)) {
    console.error("Validation failed. AJV valid:", ajvValid);
    if (ajvErrors && ajvErrors.length) console.error("AJV errors:", JSON.stringify(ajvErrors, null, 2));
    if (refErrors && refErrors.length) console.error("Referential errors:", JSON.stringify(refErrors, null, 2));
    if (refWarnings && refWarnings.length) console.warn("Referential warnings:", JSON.stringify(refWarnings, null, 2));
    process.exit(6);
  }

  // prepare output dirs
  fs.mkdirSync(outDir, { recursive: true });
  const artifactsDir = path.join(outDir, "artifacts");
  const erdDir = path.join(outDir, "erd");
  const lineageDir = path.join(outDir, "lineage");
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(erdDir, { recursive: true });
  fs.mkdirSync(lineageDir, { recursive: true });

  // write mapping CSV
  try {
    writeMappingCSV(ast, artifactsDir);
    console.log("Wrote mapping_matrix.csv to", artifactsDir);
  } catch (e: any) {
    console.error("Error writing mapping CSV:", e);
  }

  // generate ERD mermaid files
  try {
    const mermaids = generateMermaidERD(ast, erdDir);
    console.log("Wrote mermaid ERD files to", erdDir, mermaids.map((m: any) => m.name).join(", "));
  } catch (e: any) {
    console.error("Error generating ERD mermaid:", e);
  }

  // generate lineage JSON
  try {
    const lineage = generateLineageJSON(ast, lineageDir);
    const outFile = path.join(lineageDir, "lineage.json");
    fs.writeFileSync(outFile, JSON.stringify(lineage, null, 2), "utf8");
    console.log("Wrote lineage JSON to", outFile);
  } catch (e: any) {
    console.error("Error generating lineage JSON:", e);
  }

  // copy mapping csv to root out dir for convenience
  try {
    const csvSrc = path.join(artifactsDir, "mapping_matrix.csv");
    if (fs.existsSync(csvSrc)) {
      fs.copyFileSync(csvSrc, path.join(outDir, "mapping_matrix.csv"));
    }
  } catch {}

  console.log("Generation complete. Output directory:", outDir);
  process.exit(0);
}

async function main() {
  try {
    const argv = parseArgs();
    const cmd = argv._[0];
    const dir = argv.dir || argv.d;
    const out = argv.out || argv.o;

    if (!cmd) {
      usage();
      process.exit(1);
    }

    if (cmd === "validate") {
      await cmdValidate(dir);
    } else if (cmd === "generate") {
      await cmdGenerate(dir, out);
    } else {
      console.error("Unknown command:", cmd);
      usage();
      process.exit(1);
    }
  } catch (err: any) {
    console.error("CLI fatal error:", err);
    process.exit(99);
  }
}

main();
