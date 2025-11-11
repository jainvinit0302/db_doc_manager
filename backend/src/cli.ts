#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { loadDbdocFiles, validateStructure, normalize } from './parser';
import { writeMappingCSV, generateMermaidERD, generateLineageGraph } from './generator';
import { referentialValidate } from './validator';

const program = new Command();

program.name('dbdoc').description('DBDocManager CLI').version('0.1.0');

/* =========================================================
   🧩 1. VALIDATE COMMAND (unchanged)
   ========================================================= */
program
  .command('validate')
  .description('Validate .dbdoc files against schema and run basic checks')
  .option('--dir <dir>', 'directory containing dbdoc files', '.dbdoc')
  .action((opts) => {
    try {
      const files = loadDbdocFiles(opts.dir);
      if (files.length === 0) {
        console.error(`No dbdoc files found in ${opts.dir}. Please add DSL files under ${opts.dir}`);
        process.exit(2);
      }

      // 1) Structural validation per file (AJV)
      let hadErrors = false;
      for (const f of files) {
        const { parsed, path: p } = f;
        const result = validateStructure(parsed);
        if (!result.valid) {
          console.error(`Validation errors in ${p}:`);
          console.error(JSON.stringify(result.errors, null, 2));
          hadErrors = true;
        } else {
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
      }, {} as any);

      const ast = normalize(aggregated);

      const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

      if (refWarnings && refWarnings.length) {
        console.warn('Referential validation warnings:');
        for (const w of refWarnings) console.warn('  -', w);
      }

      if (refErrors && refErrors.length) {
        console.error('Referential validation errors:');
        for (const e of refErrors) console.error('  -', e);
      }

      const exitCode = (hadErrors || (refErrors && refErrors.length > 0)) ? 1 : 0;
      process.exit(exitCode);

    } catch (err) {
      console.error('Error during validation:', err);
      process.exit(3);
    }
  });

/* =========================================================
   🧱 2. GENERATE COMMAND (enhanced with lineage)
   ========================================================= */
program
  .command('generate')
  .description('Generate docs/artifacts (CSV, ERD, Lineage) from .dbdoc files')
  .option('--dir <dir>', 'directory containing dbdoc files', '.dbdoc')
  .option('--out <out>', 'output directory', './docs')
  .action((opts) => {
    try {
      const files = loadDbdocFiles(opts.dir);
      if (files.length === 0) {
        console.error(`No dbdoc files found in ${opts.dir}`);
        process.exit(2);
      }

      // Merge DSL objects into one aggregated structure
      const parsed = files.map(f => f.parsed).reduce((acc, cur) => {
        acc.targets = (acc.targets || []).concat(cur.targets || []);
        acc.sources = (acc.sources || []).concat(cur.sources || []);
        acc.mappings = (acc.mappings || []).concat(cur.mappings || []);
        acc.project = acc.project || cur.project;
        return acc;
      }, {} as any);

      const ast = normalize(parsed);

      // --- Existing outputs ---
      writeMappingCSV(ast, path.join(opts.out, 'artifacts'));
      generateMermaidERD(ast, path.join(opts.out, 'erd'));

      // --- NEW: Data Lineage JSON ---
      generateLineageGraph(ast, path.join(opts.out, 'artifacts'));

      console.log(`✅ Generation complete. Artifacts in ${opts.out}`);
    } catch (err) {
      console.error('Error during generation:', err);
      process.exit(3);
    }
  });

program.parse(process.argv);
