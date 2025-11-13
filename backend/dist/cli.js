"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/cli.ts
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const process_1 = __importDefault(require("process"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const parser_1 = require("./parser");
const validator_1 = require("./validator");
const generator_1 = require("./generator");
/**
 * Minimal arg parser (no external dependency)
 */
function parseArgs() {
    const raw = process_1.default.argv.slice(2);
    const result = { _: [] };
    let i = 0;
    while (i < raw.length) {
        const token = raw[i];
        if (token.startsWith("--")) {
            const key = token.slice(2);
            const next = raw[i + 1];
            if (next && !next.startsWith("--")) {
                result[key] = next;
                i += 2;
            }
            else {
                result[key] = true;
                i++;
            }
        }
        else if (token.startsWith("-")) {
            const key = token.slice(1);
            const next = raw[i + 1];
            if (next && !next.startsWith("-")) {
                result[key] = next;
                i += 2;
            }
            else {
                result[key] = true;
                i++;
            }
        }
        else {
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
function safeLoadYamlObject(raw, sourcePath = "<input>") {
    const parsed = js_yaml_1.default.load(raw);
    if (Array.isArray(parsed)) {
        // pick the first non-empty object in multi-doc YAML
        const firstObj = parsed.find((d) => d && typeof d === "object");
        if (!firstObj) {
            throw new Error(`YAML parse for ${sourcePath} returned an array but contained no object documents.`);
        }
        return firstObj;
    }
    if (!parsed || typeof parsed !== "object") {
        throw new Error(`YAML parse for ${sourcePath} returned a ${parsed === null ? "null" : typeof parsed} — expected an object at root.`);
    }
    return parsed;
}
/**
 * Validate command: checks each file with AJV + referential validator
 */
async function cmdValidate(dir) {
    if (!dir) {
        console.error("Missing --dir");
        usage();
        process_1.default.exit(2);
    }
    const files = (0, parser_1.loadDbdocFiles)(dir);
    if (!files || files.length === 0) {
        console.error("No dbdoc files found in", dir);
        process_1.default.exit(3);
    }
    let overallValid = true;
    for (const f of files) {
        try {
            // --- robustly obtain parsed object from loader result ---
            // loader may return { parsed, raw } or { path, content } etc.
            let parsed = undefined;
            // prefer loader's parsed if present and is object
            if (f && f.parsed && typeof f.parsed === "object") {
                parsed = f.parsed;
            }
            else if (f && typeof f.raw === "string") {
                // attempt to parse the raw YAML text
                try {
                    parsed = safeLoadYamlObject(f.raw, f.path);
                }
                catch (e) {
                    console.error(`${f.path}: YAML parse/shape error: ${e.message}`);
                    overallValid = false;
                    continue;
                }
            }
            else if (f && typeof f.content === "string") {
                try {
                    parsed = safeLoadYamlObject(f.content, f.path);
                }
                catch (e) {
                    console.error(`${f.path}: YAML parse/shape error: ${e.message}`);
                    overallValid = false;
                    continue;
                }
            }
            else {
                console.error(`${f.path || '<unknown>'}: unsupported file entry shape from loader: ${JSON.stringify(Object.keys(f))}`);
                overallValid = false;
                continue;
            }
            // --- proceed with validation using `parsed` object ---
            const ajvResult = (0, parser_1.validateStructure)(parsed);
            const ajvValid = ajvResult.valid;
            const ajvErrors = ajvResult.errors || [];
            const aggregated = {
                targets: parsed.targets || [],
                sources: parsed.sources || [],
                mappings: parsed.mappings || [],
            };
            const ast = (0, parser_1.normalize)(aggregated);
            const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
            const valid = ajvValid && (!refErrors || refErrors.length === 0);
            if (!valid) {
                overallValid = false;
                console.error(`${f.path}: INVALID`);
                console.error("  ajvValid:", ajvValid);
                if (ajvErrors && ajvErrors.length)
                    console.error("  ajvErrors:", JSON.stringify(ajvErrors, null, 2));
                if (refErrors && refErrors.length)
                    console.error("  referentialErrors:", JSON.stringify(refErrors, null, 2));
                if (refWarnings && refWarnings.length)
                    console.warn("  referentialWarnings:", JSON.stringify(refWarnings, null, 2));
            }
            else {
                console.log(`${f.path}: OK`);
            }
        }
        catch (err) {
            overallValid = false;
            console.error(`${f.path}: parse/validation error:`, err.message || err);
        }
    }
    if (!overallValid)
        process_1.default.exit(4);
    process_1.default.exit(0);
}
/**
 * Generate command: merges files into a combined AST and emits artifacts to outDir
 */
async function cmdGenerate(dir, outDir) {
    if (!dir) {
        console.error("Missing --dir");
        usage();
        process_1.default.exit(2);
    }
    outDir = outDir || path_1.default.resolve(process_1.default.cwd(), "docs");
    const files = (0, parser_1.loadDbdocFiles)(dir);
    if (!files || files.length === 0) {
        console.error("No dbdoc files found in", dir);
        process_1.default.exit(3);
    }
    // Aggregate parsed content across files
    const aggregatedTargets = [];
    const aggregatedSources = [];
    const aggregatedMappings = [];
    for (const f of files) {
        let parsed;
        // Accept loader-provided parsed, or parse raw/content
        if (f && f.parsed && typeof f.parsed === "object") {
            parsed = f.parsed;
        }
        else if (f && typeof f.raw === "string") {
            try {
                parsed = safeLoadYamlObject(f.raw, f.path);
            }
            catch (e) {
                console.error("YAML parse error in", f.path, String(e.message || e));
                process_1.default.exit(5);
            }
        }
        else if (f && typeof f.content === "string") {
            try {
                parsed = safeLoadYamlObject(f.content, f.path);
            }
            catch (e) {
                console.error("YAML parse error in", f.path, String(e.message || e));
                process_1.default.exit(5);
            }
        }
        else {
            console.error(`${f.path || '<unknown>'}: unsupported file entry shape from loader: ${JSON.stringify(Object.keys(f))}`);
            process_1.default.exit(5);
        }
        aggregatedTargets.push(...(parsed.targets || []));
        aggregatedSources.push(...(parsed.sources || []));
        aggregatedMappings.push(...(parsed.mappings || []));
    }
    const aggregated = { targets: aggregatedTargets, sources: aggregatedSources, mappings: aggregatedMappings };
    const ast = (0, parser_1.normalize)(aggregated);
    const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
    let firstParsed = null;
    const firstFileWithParsed = files.find((f) => f && f.parsed && typeof f.parsed === "object");
    if (firstFileWithParsed)
        firstParsed = firstFileWithParsed.parsed;
    else if (files.length > 0) {
        // fallback: try to parse the first file's raw/content to extract metadata
        const f0 = files[0];
        try {
            if (f0 && typeof f0.raw === "string")
                firstParsed = safeLoadYamlObject(f0.raw, f0.path);
            else if (f0 && typeof f0.content === "string")
                firstParsed = safeLoadYamlObject(f0.content, f0.path);
        }
        catch {
            firstParsed = null;
        }
    }
    // Compose root object for AJV validation
    const rootObj = {
        targets: aggregatedTargets,
        sources: aggregatedSources,
        mappings: aggregatedMappings,
    };
    // copy common top-level metadata if present
    if (firstParsed && typeof firstParsed === "object") {
        if (firstParsed.project)
            rootObj.project = firstParsed.project;
        if (firstParsed.version)
            rootObj.version = firstParsed.version;
        if (firstParsed.owners)
            rootObj.owners = firstParsed.owners;
        if (firstParsed.tags)
            rootObj.tags = firstParsed.tags;
    }
    const ajvResult = (0, parser_1.validateStructure)(rootObj);
    const ajvValid = ajvResult.valid;
    const ajvErrors = ajvResult.errors || [];
    if (!ajvValid || (refErrors && refErrors.length > 0)) {
        console.error("Validation failed. AJV valid:", ajvValid);
        if (ajvErrors && ajvErrors.length)
            console.error("AJV errors:", JSON.stringify(ajvErrors, null, 2));
        if (refErrors && refErrors.length)
            console.error("Referential errors:", JSON.stringify(refErrors, null, 2));
        if (refWarnings && refWarnings.length)
            console.warn("Referential warnings:", JSON.stringify(refWarnings, null, 2));
        process_1.default.exit(6);
    }
    // prepare output dirs
    fs_1.default.mkdirSync(outDir, { recursive: true });
    const artifactsDir = path_1.default.join(outDir, "artifacts");
    const erdDir = path_1.default.join(outDir, "erd");
    const lineageDir = path_1.default.join(outDir, "lineage");
    fs_1.default.mkdirSync(artifactsDir, { recursive: true });
    fs_1.default.mkdirSync(erdDir, { recursive: true });
    fs_1.default.mkdirSync(lineageDir, { recursive: true });
    // write mapping CSV
    try {
        (0, generator_1.writeMappingCSV)(ast, artifactsDir);
        console.log("Wrote mapping_matrix.csv to", artifactsDir);
    }
    catch (e) {
        console.error("Error writing mapping CSV:", e);
    }
    // generate ERD mermaid files
    try {
        const mermaids = (0, generator_1.generateMermaidERD)(ast, erdDir);
        console.log("Wrote mermaid ERD files to", erdDir, mermaids.map((m) => m.name).join(", "));
    }
    catch (e) {
        console.error("Error generating ERD mermaid:", e);
    }
    // generate lineage JSON
    try {
        const lineage = (0, generator_1.generateLineageJSON)(ast, lineageDir);
        const outFile = path_1.default.join(lineageDir, "lineage.json");
        fs_1.default.writeFileSync(outFile, JSON.stringify(lineage, null, 2), "utf8");
        console.log("Wrote lineage JSON to", outFile);
    }
    catch (e) {
        console.error("Error generating lineage JSON:", e);
    }
    // copy mapping csv to root out dir for convenience
    try {
        const csvSrc = path_1.default.join(artifactsDir, "mapping_matrix.csv");
        if (fs_1.default.existsSync(csvSrc)) {
            fs_1.default.copyFileSync(csvSrc, path_1.default.join(outDir, "mapping_matrix.csv"));
        }
    }
    catch { }
    console.log("Generation complete. Output directory:", outDir);
    process_1.default.exit(0);
}
async function main() {
    try {
        const argv = parseArgs();
        const cmd = argv._[0];
        const dir = argv.dir || argv.d;
        const out = argv.out || argv.o;
        if (!cmd) {
            usage();
            process_1.default.exit(1);
        }
        if (cmd === "validate") {
            await cmdValidate(dir);
        }
        else if (cmd === "generate") {
            await cmdGenerate(dir, out);
        }
        else {
            console.error("Unknown command:", cmd);
            usage();
            process_1.default.exit(1);
        }
    }
    catch (err) {
        console.error("CLI fatal error:", err);
        process_1.default.exit(99);
    }
}
main();
