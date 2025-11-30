#!/usr/bin/env node
// backend/src/cli.ts - Enhanced CLI with commander.js
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import http from 'http';
import YAML from 'js-yaml';
import { loadDbdocFiles, validateStructure, normalize } from './parser';
import { referentialValidate } from './validator';
import { writeMappingCSV, generateMermaidERD, generateLineageJSON } from './generator';
import { generateStaticSite } from './doc_generator';
import { getAvailableTransforms } from './transforms';

const program = new Command();

// ========== Helper Functions ==========

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeLoadYamlObject(yamlStr: string, sourcePath?: string): any {
  const parsed = YAML.load(yamlStr);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected object at root, got ${typeof parsed} in ${sourcePath || 'input'}`);
  }
  return parsed;
}

// ========== Commands ==========

/**
 * Init Command - Initialize a new DBDoc project
 */
async function initCommand(projectName?: string) {
  const name = projectName || 'my-project';
  const projectDir = path.resolve(process.cwd(), name);

  console.log(chalk.blue('🚀 Initializing DBDoc project...'));
  console.log(chalk.gray(`   Project: ${name}`));
  console.log(chalk.gray(`   Directory: ${projectDir}\n`));

  // Create directory structure
  try {
    ensureDir(projectDir);
    ensureDir(path.join(projectDir, '.dbdoc'));
    ensureDir(path.join(projectDir, 'schemas'));

    console.log(chalk.green('✓') + ' Created project structure');

    // Create sample schema file
    const sampleSchema = `project: "${name}"
version: "1.0"
owners:
  - name: "Your Team"
    email: "team@example.com"

sources:
  - id: source_db
    kind: postgres
    db: source_database
    description: "Source database"

targets:
  - db: dw
    engine: postgres
    schema: public
    tables:
      - name: example_table
        description: "Example target table"
        columns:
          - name: id
            type: INTEGER
            pk: true
            description: "Primary key"
          
          - name: name
            type: VARCHAR(255)
            not_null: true
            description: "Name field"
          
          - name: created_at
            type: TIMESTAMP
            default: now()
            description: "Creation timestamp"

mappings:
  - target: dw.public.example_table.name
    from:
      source_id: source_db
      path: $.user.name
      transform: trim()
    notes: "Map user name from source"
`;

    fs.writeFileSync(
      path.join(projectDir, 'schemas', 'example.yaml'),
      sampleSchema,
      'utf8'
    );

    console.log(chalk.green('✓') + ' Created example schema');

    // Create .gitignore
    const gitignore = `node_modules/
.dbdoc/cache/
docs/
*.log
`;
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore, 'utf8');

    console.log(chalk.green('✓') + ' Created .gitignore');

    // Create README
    const readme = `# ${name}

DBDocManager Project

## Quick Start

1. Edit your schema in \`schemas/example.yaml\`
2. Validate: \`dbdoc validate schemas/example.yaml\`
3. Generate docs: \`dbdoc generate schemas/example.yaml\`
4. View docs: \`dbdoc serve\`

## Learn More

- [DBDocManager Docs](https://github.com/yourorg/dbdoc-manager)
- [DSL Reference](https://github.com/yourorg/dbdoc-manager/docs/dsl)
`;

    fs.writeFileSync(path.join(projectDir, 'README.md'), readme, 'utf8');

    console.log(chalk.green('✓') + ' Created README.md\n');

    // Success message
    console.log(chalk.green('✨ Project initialized successfully!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.gray(`  cd ${name}`));
    console.log(chalk.gray(`  dbdoc validate schemas/example.yaml`));
    console.log(chalk.gray(`  dbdoc generate schemas/example.yaml`));
    console.log(chalk.gray(`  dbdoc serve\n`));

  } catch (error: any) {
    console.error(chalk.red('✗ Error initializing project:'), error.message);
    process.exit(1);
  }
}

/**
 * Validate Command - Validate DSL files
 */
async function validateCommand(fileOrDir: string, options: any) {
  console.log(chalk.blue('🔍 Validating DSL...\n'));

  try {
    const files = loadDbdocFiles(fileOrDir) as any[];

    if (!files || files.length === 0) {
      console.error(chalk.red('✗ No DSL files found in'), fileOrDir);
      process.exit(3);
    }

    console.log(chalk.gray(`Found ${files.length} file(s)\n`));

    let overallValid = true;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const f of files) {
      try {
        let parsed: any = undefined;

        if (f && f.parsed && typeof f.parsed === 'object') {
          parsed = f.parsed;
        } else if (f && typeof f.raw === 'string') {
          parsed = safeLoadYamlObject(f.raw, f.path);
        } else if (f && typeof f.content === 'string') {
          parsed = safeLoadYamlObject(f.content, f.path);
        }

        const ajvResult = validateStructure(parsed);
        const aggregated = {
          targets: parsed.targets || [],
          sources: parsed.sources || [],
          mappings: parsed.mappings || [],
        };
        const ast = normalize(aggregated);
        const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

        const valid = ajvResult.valid && (!refErrors || refErrors.length === 0);

        if (!valid) {
          overallValid = false;
          console.log(chalk.red('✗'), chalk.bold(f.path), chalk.red('INVALID'));

          if (ajvResult.errors && ajvResult.errors.length) {
            console.log(chalk.gray('  Schema errors:'));
            ajvResult.errors.forEach(e => {
              console.log(chalk.red('    •'), e.message || e);
              totalErrors++;
            });
          }

          if (refErrors && refErrors.length) {
            console.log(chalk.gray('  Referential errors:'));
            refErrors.forEach(e => {
              console.log(chalk.red('    •'), e);
              totalErrors++;
            });
          }

          if (refWarnings && refWarnings.length) {
            console.log(chalk.yellow('  Warnings:'));
            refWarnings.forEach(w => {
              console.log(chalk.yellow('    •'), w);
              totalWarnings++;
            });
          }
          console.log('');
        } else {
          console.log(chalk.green('✓'), chalk.bold(f.path), chalk.green('OK'));

          if (refWarnings && refWarnings.length) {
            refWarnings.forEach(w => {
              console.log(chalk.yellow('  ⚠'), w);
              totalWarnings++;
            });
          }
        }
      } catch (err: any) {
        overallValid = false;
        console.log(chalk.red('✗'), chalk.bold(f.path), chalk.red('ERROR'));
        console.log(chalk.red('  •'), err.message || err);
        console.log('');
        totalErrors++;
      }
    }

    // Summary
    console.log('');
    console.log(chalk.bold('Summary:'));
    console.log(chalk.gray(`  Files validated: ${files.length}`));
    console.log(chalk.gray(`  Errors: ${totalErrors}`));
    console.log(chalk.gray(`  Warnings: ${totalWarnings}`));
    console.log('');

    if (!overallValid) {
      console.log(chalk.red('✗ Validation failed'));
      process.exit(4);
    }

    console.log(chalk.green('✓ All validations passed!'));
    process.exit(0);

  } catch (error: any) {
    console.error(chalk.red('✗ Validation error:'), error.message);
    process.exit(1);
  }
}

/**
 * Generate Command - Generate documentation and artifacts
 */
async function generateCommand(fileOrDir: string, options: any) {
  const outDir = options.out || path.resolve(process.cwd(), 'docs');

  console.log(chalk.blue('📚 Generating documentation...\n'));
  console.log(chalk.gray(`  Input: ${fileOrDir}`));
  console.log(chalk.gray(`  Output: ${outDir}\n`));

  try {
    const files = loadDbdocFiles(fileOrDir) as any[];

    if (!files || files.length === 0) {
      console.error(chalk.red('✗ No DSL files found'));
      process.exit(3);
    }

    // Aggregate files
    const aggregatedTargets: any[] = [];
    const aggregatedSources: any[] = [];
    const aggregatedMappings: any[] = [];

    for (const f of files) {
      let parsed: any;
      if (f && f.parsed && typeof f.parsed === 'object') {
        parsed = f.parsed;
      } else if (f && typeof f.raw === 'string') {
        parsed = safeLoadYamlObject(f.raw, f.path);
      } else if (f && typeof f.content === 'string') {
        parsed = safeLoadYamlObject(f.content, f.path);
      }

      aggregatedTargets.push(...(parsed.targets || []));
      aggregatedSources.push(...(parsed.sources || []));
      aggregatedMappings.push(...(parsed.mappings || []));
    }

    const aggregated = { targets: aggregatedTargets, sources: aggregatedSources, mappings: aggregatedMappings };
    const ast = normalize(aggregated);
    const { errors: refErrors, warnings: refWarnings } = referentialValidate(ast);

    // Validate before generating
    if (refErrors && refErrors.length > 0) {
      console.error(chalk.red('✗ Validation failed. Fix errors before generating.'));
      refErrors.forEach(e => console.error(chalk.red('  •'), e));
      process.exit(6);
    }

    // Create output directories
    ensureDir(outDir);
    const artifactsDir = path.join(outDir, 'artifacts');
    const erdDir = path.join(outDir, 'erd');
    const lineageDir = path.join(outDir, 'lineage');
    ensureDir(artifactsDir);
    ensureDir(erdDir);
    ensureDir(lineageDir);

    // Generate artifacts
    console.log(chalk.gray('Generating artifacts...'));

    writeMappingCSV(ast, artifactsDir);
    console.log(chalk.green('✓'), 'Mapping matrix CSV');

    const mermaids = generateMermaidERD(ast, erdDir);
    console.log(chalk.green('✓'), `ERD diagrams (${mermaids.length})`);

    const lineageFile = path.join(lineageDir, 'lineage.json');
    const lineage = generateLineageJSON(ast, lineageDir);
    fs.writeFileSync(lineageFile, JSON.stringify(lineage, null, 2), 'utf8');
    console.log(chalk.green('✓'), 'Lineage JSON');

    generateStaticSite(ast, outDir);
    console.log(chalk.green('✓'), 'Static HTML site');

    // Copy CSV to root
    const csvSrc = path.join(artifactsDir, 'mapping_matrix.csv');
    if (fs.existsSync(csvSrc)) {
      fs.copyFileSync(csvSrc, path.join(outDir, 'mapping_matrix.csv'));
    }

    console.log('');
    console.log(chalk.green('✨ Documentation generated successfully!'));
    console.log(chalk.gray(`   Output: ${outDir}`));
    console.log(chalk.gray(`   Open: ${path.join(outDir, 'index.html')}\n`));

    process.exit(0);

  } catch (error: any) {
    console.error(chalk.red('✗ Generation error:'), error.message);
    process.exit(1);
  }
}

/**
 * Serve Command - Start local documentation server
 */
async function serveCommand(options: any) {
  const port = options.port || 8080;
  const docsDir = options.dir || path.resolve(process.cwd(), 'docs');

  if (!fs.existsSync(docsDir)) {
    console.error(chalk.red('✗ Documentation directory not found:'), docsDir);
    console.log(chalk.gray('\n  Run'), chalk.cyan('dbdoc generate'), chalk.gray('first\n'));
    process.exit(1);
  }

  console.log(chalk.blue('🌐 Starting documentation server...\n'));

  const server = http.createServer((req, res) => {
    let filePath = path.join(docsDir, req.url === '/' ? 'index.html' : req.url!);

    // Security: prevent directory traversal
    if (!filePath.startsWith(docsDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
        return;
      }

      // Set content type
      const ext = path.extname(filePath);
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };

      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log(chalk.green('✓ Server running'));
    console.log(chalk.gray(`  Directory: ${docsDir}`));
    console.log(chalk.bold(`  URL: http://localhost:${port}`));
    console.log('');
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
  });
}

/**
 * List Command - List tables, sources, or transforms
 */
async function listCommand(type: string, fileOrDir?: string) {
  if (type === 'transforms') {
    console.log(chalk.blue('📋 Available Transforms\n'));

    const transforms = getAvailableTransforms();
    console.log(chalk.gray(`Found ${transforms.length} transform functions:\n`));

    transforms.forEach(t => {
      console.log(chalk.green('•'), chalk.bold(t.name + '()'));
      console.log(chalk.gray(`  ${t.description}`));
      console.log(chalk.gray(`  Args: ${t.minArgs} - ${t.maxArgs === Infinity ? '∞' : t.maxArgs}\n`));
    });

    return;
  }

  if (!fileOrDir) {
    console.error(chalk.red('✗ File or directory required for listing'), type);
    process.exit(1);
  }

  try {
    const files = loadDbdocFiles(fileOrDir) as any[];

    if (!files || files.length === 0) {
      console.error(chalk.red('✗ No DSL files found'));
      process.exit(3);
    }

    // Aggregate
    const aggregatedTargets: any[] = [];
    const aggregatedSources: any[] = [];

    for (const f of files) {
      let parsed: any;
      if (f && f.parsed && typeof f.parsed === 'object') {
        parsed = f.parsed;
      } else if (f && typeof f.raw === 'string') {
        parsed = safeLoadYamlObject(f.raw, f.path);
      }

      aggregatedTargets.push(...(parsed.targets || []));
      aggregatedSources.push(...(parsed.sources || []));
    }

    if (type === 'tables') {
      console.log(chalk.blue('📊 Tables\n'));

      aggregatedTargets.forEach(target => {
        const tables = target.tables || [];
        tables.forEach((table: any) => {
          const fullName = `${target.db}.${target.schema}.${table.name}`;
          const colCount = (table.columns || []).length;
          console.log(chalk.green('•'), chalk.bold(fullName));
          console.log(chalk.gray(`  ${colCount} columns`));
          if (table.description) {
            console.log(chalk.gray(`  ${table.description}`));
          }
          console.log('');
        });
      });
    } else if (type === 'sources') {
      console.log(chalk.blue('🔌 Sources\n'));

      aggregatedSources.forEach(source => {
        console.log(chalk.green('•'), chalk.bold(source.id));
        console.log(chalk.gray(`  Type: ${source.kind}`));
        if (source.db) console.log(chalk.gray(`  DB: ${source.db}`));
        if (source.description) console.log(chalk.gray(`  ${source.description}`));
        console.log('');
      });
    }

  } catch (error: any) {
    console.error(chalk.red('✗ Error:'), error.message);
    process.exit(1);
  }
}

// ========== CLI Setup ==========

program
  .name('dbdoc')
  .description('DSL-driven documentation & lineage for data models')
  .version('2.2.0');

program
  .command('init [project-name]')
  .description('Initialize a new DBDoc project')
  .action(initCommand);

program
  .command('validate <file>')
  .description('Validate DSL files')
  .option('--strict', 'Treat warnings as errors')
  .action(validateCommand);

program
  .command('generate <file>')
  .description('Generate documentation and artifacts')
  .option('-o, --out <dir>', 'Output directory', 'docs')
  .action(generateCommand);

program
  .command('serve')
  .description('Start local documentation server')
  .option('-p, --port <port>', 'Port number', '8080')
  .option('-d, --dir <dir>', 'Documentation directory', 'docs')
  .action(serveCommand);

program
  .command('list <type> [file]')
  .description('List tables, sources, or transforms')
  .action(listCommand);

program.parse();
