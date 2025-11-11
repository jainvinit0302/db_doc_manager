#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const validator_1 = require("./validator");
const program = new commander_1.Command();
program.name('dbdoc').description('DBDocManager CLI').version('0.1.0');
program
    .command('validate')
    .description('Validate .dboc files against schema and run basic checks')
    .option('--dir <dir>', 'directory containing dbdoc files', '.dbdoc')
    .action((opts) => {
    try {
        const files = (0, parser_1.loadDbdocFiles)(opts.dir);
        if (files.length === 0) {
            console.error(`No dbdoc files found in ${opts.dir}. Please add DSL files under ${opts.dir}`);
            process.exit(2);
        }
        // 1) Structural validation per file (AJV)
        let hadErrors = false;
        for (const f of files) {
            const { parsed, path: p } = f;
            const result = (0, parser_1.validateStructure)(parsed);
            if (!result.valid) {
                console.error(`Validation errors in ${p}:`);
                console.error(JSON.stringify(result.errors, null, 2));
                hadErrors = true;
            }
            else {
                console.log(`${p}: OK`);
            }
        }
        // 2) Build aggregated AST (merge targets/sources/mappings) and run referential validation
        const aggregated = files.map(f => f.parsed).reduce((acc, cur) => {
            acc.targets = (acc.targets || []).concat(cur.targets || []);
            acc.sources = (acc.sources || []).concat(cur.sources || []);
            acc.mappings = (acc.mappings || []).concat(cur.mappings || []);
            acc.project = acc.project || cur.project;
            return acc;
        }, {});
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
        if (refWarnings && refWarnings.length) {
            console.warn('Referential validation warnings:');
            for (const w of refWarnings)
                console.warn('  -', w);
        }
        if (refErrors && refErrors.length) {
            console.error('Referential validation errors:');
            for (const e of refErrors)
                console.error('  -', e);
        }
        const exitCode = (hadErrors || (refErrors && refErrors.length > 0)) ? 1 : 0;
        process.exit(exitCode);
    }
    catch (err) {
        console.error('Error during validation:', err);
        process.exit(3);
    }
});
program
    .command('generate')
    .description('Generate docs/artifacts from .dbdoc files')
    .option('--dir <dir>', 'directory containing dbdoc files', '.dbdoc')
    .option('--out <out>', 'output directory', './docs')
    .action((opts) => {
    try {
        // load/parse one aggregated AST for now
        const files = (0, parser_1.loadDbdocFiles)(opts.dir);
        if (files.length === 0) {
            console.error(`No dbdoc files found in ${opts.dir}`);
            process.exit(2);
        }
        // For demo: take first file's parsed object and normalize
        // In full implementation, you should merge multiple files
        const parsed = files.map(f => f.parsed).reduce((acc, cur) => {
            // naive merge: arrays concatenation for top-level arrays
            acc.targets = (acc.targets || []).concat(cur.targets || []);
            acc.sources = (acc.sources || []).concat(cur.sources || []);
            acc.mappings = (acc.mappings || []).concat(cur.mappings || []);
            acc.project = acc.project || cur.project;
            return acc;
        }, {});
        const ast = (0, parser_1.normalize)(parsed);
        // write CSV
        (0, generator_1.writeMappingCSV)(ast, path_1.default.join(opts.out, 'artifacts'));
        // generate mermaid ERD files
        (0, generator_1.generateMermaidERD)(ast, path_1.default.join(opts.out, 'erd'));
        console.log(`Generation complete. Artifacts in ${opts.out}`);
    }
    catch (err) {
        console.error('Error during generation:', err);
        process.exit(3);
    }
});
program.parse(process.argv);
