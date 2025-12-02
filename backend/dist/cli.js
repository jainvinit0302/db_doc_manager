#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/cli.ts - Enhanced CLI with commander.js
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const parser_1 = require("./parser");
const validator_1 = require("./validator");
const generator_1 = require("./generator");
const doc_generator_1 = require("./doc_generator");
const transforms_1 = require("./transforms");
const postgres_1 = require("./introspection/postgres");
const mongodb_1 = require("./introspection/mongodb");
const program = new commander_1.Command();
// ========== Helper Functions ==========
function ensureDir(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
}
function safeLoadYamlObject(yamlStr, sourcePath) {
    const parsed = js_yaml_1.default.load(yamlStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Expected object at root, got ${typeof parsed} in ${sourcePath || 'input'}`);
    }
    return parsed;
}
// ========== Commands ==========
/**
 * Init Command - Initialize a new DBDoc project
 */
async function initCommand(projectName) {
    const name = projectName || 'my-project';
    const projectDir = path_1.default.resolve(process.cwd(), name);
    console.log(chalk_1.default.blue('🚀 Initializing DBDoc project...'));
    console.log(chalk_1.default.gray(`   Project: ${name}`));
    console.log(chalk_1.default.gray(`   Directory: ${projectDir}\n`));
    // Create directory structure
    try {
        ensureDir(projectDir);
        ensureDir(projectDir);
        ensureDir(path_1.default.join(projectDir, '.dbdoc'));
        // ensureDir(path.join(projectDir, 'schemas')); // Removed schemas dir to match user request
        console.log(chalk_1.default.green('✓') + ' Created project structure');
        // Create sample schema file
        const sampleSchema = `project: "${name}"
version: "1.0"
owners:
  - "team@example.com"

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
        fs_1.default.writeFileSync(path_1.default.join(projectDir, 'schema.yaml'), sampleSchema, 'utf8');
        console.log(chalk_1.default.green('✓') + ' Created schema.yaml');
        // Create .gitignore
        const gitignore = `node_modules/
.dbdoc/cache/
docs/
*.log
`;
        fs_1.default.writeFileSync(path_1.default.join(projectDir, '.gitignore'), gitignore, 'utf8');
        console.log(chalk_1.default.green('✓') + ' Created .gitignore');
        // Create README
        const readme = `# ${name}

DBDocManager Project

## Quick Start Guide (CLI)

1. **Initialize Project**

   \`\`\`bash
   dbdoc init ${name}
   cd ${name}
   \`\`\`

2. **Introspect Database (Optional)**

   \`\`\`bash
   # Auto-generate DSL from existing DB
   dbdoc introspect postgres "postgresql://user:pass@localhost/mydb" --out schema.yaml
   \`\`\`

3. **Validate DSL**

   \`\`\`bash
   dbdoc validate schema.yaml
   \`\`\`

4. **Generate Documentation**

   \`\`\`bash
   dbdoc generate schema.yaml --out docs
   \`\`\`

5. **Serve Documentation**

   \`\`\`bash
   dbdoc serve --dir docs
   \`\`\`

## Learn More

- [DBDocManager Docs](https://github.com/yourorg/dbdoc-manager)
- [DSL Reference](https://github.com/yourorg/dbdoc-manager/docs/dsl)
`;
        fs_1.default.writeFileSync(path_1.default.join(projectDir, 'README.md'), readme, 'utf8');
        console.log(chalk_1.default.green('✓') + ' Created README.md\n');
        // Success message
        console.log(chalk_1.default.green('✨ Project initialized successfully!\n'));
        console.log(chalk_1.default.bold('Next steps:'));
        console.log(chalk_1.default.gray(`  cd ${name}`));
        console.log(chalk_1.default.gray(`  dbdoc validate schema.yaml`));
        console.log(chalk_1.default.gray(`  dbdoc generate schema.yaml --out docs`));
        console.log(chalk_1.default.gray(`  dbdoc serve --dir docs\n`));
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Error initializing project:'), error.message);
        process.exit(1);
    }
}
/**
 * Validate Command - Validate DSL files
 */
async function validateCommand(fileOrDir, options) {
    console.log(chalk_1.default.blue('🔍 Validating DSL...\n'));
    try {
        const files = (0, parser_1.loadDbdocFiles)(fileOrDir);
        if (!files || files.length === 0) {
            console.error(chalk_1.default.red('✗ No DSL files found in'), fileOrDir);
            process.exit(3);
        }
        console.log(chalk_1.default.gray(`Found ${files.length} file(s)\n`));
        let overallValid = true;
        let totalErrors = 0;
        let totalWarnings = 0;
        for (const f of files) {
            try {
                let parsed = undefined;
                if (f && f.parsed && typeof f.parsed === 'object') {
                    parsed = f.parsed;
                }
                else if (f && typeof f.raw === 'string') {
                    parsed = safeLoadYamlObject(f.raw, f.path);
                }
                else if (f && typeof f.content === 'string') {
                    parsed = safeLoadYamlObject(f.content, f.path);
                }
                const ajvResult = (0, parser_1.validateStructure)(parsed);
                const aggregated = {
                    targets: parsed.targets || [],
                    sources: parsed.sources || [],
                    mappings: parsed.mappings || [],
                };
                const ast = (0, parser_1.normalize)(aggregated);
                const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
                const valid = ajvResult.valid && (!refErrors || refErrors.length === 0);
                if (!valid) {
                    overallValid = false;
                    console.log(chalk_1.default.red('✗'), chalk_1.default.bold(f.path), chalk_1.default.red('INVALID'));
                    if (ajvResult.errors && ajvResult.errors.length) {
                        console.log(chalk_1.default.gray('  Schema errors:'));
                        ajvResult.errors.forEach(e => {
                            console.log(chalk_1.default.red('    •'), e.message || e);
                            totalErrors++;
                        });
                    }
                    if (refErrors && refErrors.length) {
                        console.log(chalk_1.default.gray('  Referential errors:'));
                        refErrors.forEach(e => {
                            console.log(chalk_1.default.red('    •'), e);
                            totalErrors++;
                        });
                    }
                    if (refWarnings && refWarnings.length) {
                        console.log(chalk_1.default.yellow('  Warnings:'));
                        refWarnings.forEach(w => {
                            console.log(chalk_1.default.yellow('    •'), w);
                            totalWarnings++;
                        });
                    }
                    console.log('');
                }
                else {
                    console.log(chalk_1.default.green('✓'), chalk_1.default.bold(f.path), chalk_1.default.green('OK'));
                    if (refWarnings && refWarnings.length) {
                        refWarnings.forEach(w => {
                            console.log(chalk_1.default.yellow('  ⚠'), w);
                            totalWarnings++;
                        });
                    }
                }
            }
            catch (err) {
                overallValid = false;
                console.log(chalk_1.default.red('✗'), chalk_1.default.bold(f.path), chalk_1.default.red('ERROR'));
                console.log(chalk_1.default.red('  •'), err.message || err);
                console.log('');
                totalErrors++;
            }
        }
        // Summary
        console.log('');
        console.log(chalk_1.default.bold('Summary:'));
        console.log(chalk_1.default.gray(`  Files validated: ${files.length}`));
        console.log(chalk_1.default.gray(`  Errors: ${totalErrors}`));
        console.log(chalk_1.default.gray(`  Warnings: ${totalWarnings}`));
        console.log('');
        if (!overallValid) {
            console.log(chalk_1.default.red('✗ Validation failed'));
            process.exit(4);
        }
        console.log(chalk_1.default.green('✓ All validations passed!'));
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Validation error:'), error.message);
        process.exit(1);
    }
}
/**
 * Generate Command - Generate documentation and artifacts
 */
async function generateCommand(fileOrDir, options) {
    const outDir = options.out || path_1.default.resolve(process.cwd(), 'docs');
    console.log(chalk_1.default.blue('📚 Generating documentation...\n'));
    console.log(chalk_1.default.gray(`  Input: ${fileOrDir}`));
    console.log(chalk_1.default.gray(`  Output: ${outDir}\n`));
    try {
        const files = (0, parser_1.loadDbdocFiles)(fileOrDir);
        if (!files || files.length === 0) {
            console.error(chalk_1.default.red('✗ No DSL files found'));
            process.exit(3);
        }
        // Aggregate files
        const aggregatedTargets = [];
        const aggregatedSources = [];
        const aggregatedMappings = [];
        for (const f of files) {
            let parsed;
            if (f && f.parsed && typeof f.parsed === 'object') {
                parsed = f.parsed;
            }
            else if (f && typeof f.raw === 'string') {
                parsed = safeLoadYamlObject(f.raw, f.path);
            }
            else if (f && typeof f.content === 'string') {
                parsed = safeLoadYamlObject(f.content, f.path);
            }
            aggregatedTargets.push(...(parsed.targets || []));
            aggregatedSources.push(...(parsed.sources || []));
            aggregatedMappings.push(...(parsed.mappings || []));
        }
        const aggregated = { targets: aggregatedTargets, sources: aggregatedSources, mappings: aggregatedMappings };
        const ast = (0, parser_1.normalize)(aggregated);
        const { errors: refErrors, warnings: refWarnings } = (0, validator_1.referentialValidate)(ast);
        // Validate before generating
        if (refErrors && refErrors.length > 0) {
            console.error(chalk_1.default.red('✗ Validation failed. Fix errors before generating.'));
            refErrors.forEach(e => console.error(chalk_1.default.red('  •'), e));
            process.exit(6);
        }
        // Create output directories
        if (fs_1.default.existsSync(outDir)) {
            console.log(chalk_1.default.gray(`Cleaning output directory: ${outDir}`));
            fs_1.default.rmSync(outDir, { recursive: true, force: true });
        }
        ensureDir(outDir);
        const artifactsDir = path_1.default.join(outDir, 'artifacts');
        const erdDir = path_1.default.join(outDir, 'erd');
        const lineageDir = path_1.default.join(outDir, 'lineage');
        ensureDir(artifactsDir);
        ensureDir(erdDir);
        ensureDir(lineageDir);
        // Generate artifacts
        console.log(chalk_1.default.gray('Generating artifacts...'));
        (0, generator_1.writeMappingCSV)(ast, artifactsDir);
        console.log(chalk_1.default.green('✓'), 'Mapping matrix CSV');
        const mermaids = (0, generator_1.generateMermaidERD)(ast, erdDir);
        console.log(chalk_1.default.green('✓'), `ERD diagrams (${mermaids.length})`);
        const lineageFile = path_1.default.join(lineageDir, 'lineage.json');
        const lineage = (0, generator_1.generateLineageJSON)(ast, lineageDir);
        fs_1.default.writeFileSync(lineageFile, JSON.stringify(lineage, null, 2), 'utf8');
        console.log(chalk_1.default.green('✓'), 'Lineage JSON');
        (0, doc_generator_1.generateStaticSite)(ast, outDir);
        console.log(chalk_1.default.green('✓'), 'Static HTML site');
        // Copy CSV to root
        const csvSrc = path_1.default.join(artifactsDir, 'mapping_matrix.csv');
        if (fs_1.default.existsSync(csvSrc)) {
            fs_1.default.copyFileSync(csvSrc, path_1.default.join(outDir, 'mapping_matrix.csv'));
        }
        console.log('');
        console.log(chalk_1.default.green('✨ Documentation generated successfully!'));
        console.log(chalk_1.default.gray(`   Output: ${outDir}`));
        console.log(chalk_1.default.gray(`   Open: ${path_1.default.join(outDir, 'index.html')}\n`));
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Generation error:'), error.message);
        process.exit(1);
    }
}
/**
 * Serve Command - Start local documentation server
 */
async function serveCommand(options) {
    const port = options.port || 8080;
    const docsDir = options.dir || path_1.default.resolve(process.cwd(), 'docs');
    if (!fs_1.default.existsSync(docsDir)) {
        console.error(chalk_1.default.red('✗ Documentation directory not found:'), docsDir);
        console.log(chalk_1.default.gray('\n  Run'), chalk_1.default.cyan('dbdoc generate'), chalk_1.default.gray('first\n'));
        process.exit(1);
    }
    console.log(chalk_1.default.blue('🌐 Starting documentation server...\n'));
    const server = http_1.default.createServer((req, res) => {
        let filePath = path_1.default.join(docsDir, req.url === '/' ? 'index.html' : req.url);
        // Security: prevent directory traversal
        if (!filePath.startsWith(docsDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        fs_1.default.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('Not found');
                }
                else {
                    res.writeHead(500);
                    res.end('Server error');
                }
                return;
            }
            // Set content type
            const ext = path_1.default.extname(filePath);
            const contentTypes = {
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
        console.log(chalk_1.default.green('✓ Server running'));
        console.log(chalk_1.default.gray(`  Directory: ${docsDir}`));
        console.log(chalk_1.default.bold(`  URL: http://localhost:${port}`));
        console.log('');
        console.log(chalk_1.default.gray('  Press Ctrl+C to stop\n'));
    });
}
/**
 * List Command - List tables, sources, or transforms
 */
async function listCommand(type, fileOrDir) {
    if (type === 'transforms') {
        console.log(chalk_1.default.blue('📋 Available Transforms\n'));
        const transforms = (0, transforms_1.getAvailableTransforms)();
        console.log(chalk_1.default.gray(`Found ${transforms.length} transform functions:\n`));
        transforms.forEach(t => {
            console.log(chalk_1.default.green('•'), chalk_1.default.bold(t.name + '()'));
            console.log(chalk_1.default.gray(`  ${t.description}`));
            console.log(chalk_1.default.gray(`  Args: ${t.minArgs} - ${t.maxArgs === Infinity ? '∞' : t.maxArgs}\n`));
        });
        return;
    }
    if (!fileOrDir) {
        console.error(chalk_1.default.red('✗ File or directory required for listing'), type);
        process.exit(1);
    }
    try {
        const files = (0, parser_1.loadDbdocFiles)(fileOrDir);
        if (!files || files.length === 0) {
            console.error(chalk_1.default.red('✗ No DSL files found'));
            process.exit(3);
        }
        // Aggregate
        const aggregatedTargets = [];
        const aggregatedSources = [];
        for (const f of files) {
            let parsed;
            if (f && f.parsed && typeof f.parsed === 'object') {
                parsed = f.parsed;
            }
            else if (f && typeof f.raw === 'string') {
                parsed = safeLoadYamlObject(f.raw, f.path);
            }
            aggregatedTargets.push(...(parsed.targets || []));
            aggregatedSources.push(...(parsed.sources || []));
        }
        if (type === 'tables') {
            console.log(chalk_1.default.blue('📊 Tables\n'));
            aggregatedTargets.forEach(target => {
                const tables = target.tables || [];
                tables.forEach((table) => {
                    const fullName = `${target.db}.${target.schema}.${table.name}`;
                    const colCount = (table.columns || []).length;
                    console.log(chalk_1.default.green('•'), chalk_1.default.bold(fullName));
                    console.log(chalk_1.default.gray(`  ${colCount} columns`));
                    if (table.description) {
                        console.log(chalk_1.default.gray(`  ${table.description}`));
                    }
                    console.log('');
                });
            });
        }
        else if (type === 'sources') {
            console.log(chalk_1.default.blue('🔌 Sources\n'));
            aggregatedSources.forEach(source => {
                console.log(chalk_1.default.green('•'), chalk_1.default.bold(source.id));
                console.log(chalk_1.default.gray(`  Type: ${source.kind}`));
                if (source.db)
                    console.log(chalk_1.default.gray(`  DB: ${source.db}`));
                if (source.description)
                    console.log(chalk_1.default.gray(`  ${source.description}`));
                console.log('');
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ Error:'), error.message);
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
program
    .command('introspect')
    .description('Introspect a database and generate DSL')
    .argument('<type>', 'Database type (postgres, mongodb)')
    .argument('<connection>', 'Connection string')
    .option('-o, --out <file>', 'Output file path', 'introspected.yaml')
    .option('--schema <schema>', 'Schema to introspect (PostgreSQL only)', 'public')
    .option('--sample <n>', 'Number of documents to sample (MongoDB only)', '100')
    .action(async (type, connection, options) => {
    try {
        console.log(chalk_1.default.blue(`🔍 Introspecting ${type} database...`));
        let dsl = '';
        if (type === 'postgres') {
            dsl = await (0, postgres_1.introspectPostgreSQL)({
                connectionString: connection,
                schema: options.schema
            });
        }
        else if (type === 'mongodb') {
            dsl = await (0, mongodb_1.introspectMongoDB)({
                connectionString: connection,
                sampleSize: parseInt(options.sample)
            });
        }
        else {
            console.error(chalk_1.default.red(`Error: Unsupported database type "${type}". Use 'postgres' or 'mongodb'.`));
            process.exit(1);
        }
        fs_1.default.writeFileSync(options.out, dsl);
        console.log(chalk_1.default.green(`✅ DSL generated successfully at ${options.out}`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error during introspection:'));
        console.error(chalk_1.default.red(error.message));
        process.exit(1);
    }
});
program.parse(process.argv);
