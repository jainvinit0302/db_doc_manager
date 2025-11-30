// backend/src/doc_generator.ts
import fs from 'fs';
import path from 'path';
import { NormalizedAST } from './parser';

/**
 * Static HTML Documentation Site Generator
 * Generates standalone HTML documentation that can be deployed to GitHub Pages
 */

function ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

const CSS_STYLES = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

header h1 {
  margin-bottom: 0.5rem;
}

header .subtitle {
  opacity: 0.9;
  font-size: 1.1rem;
}

nav {
  background: white;
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

nav a {
  color: #667eea;
  text-decoration: none;
  margin-right: 1.5rem;
  font-weight: 500;
  transition: color 0.2s;
}

nav a:hover {
  color: #764ba2;
  text-decoration: underline;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.card h2 {
  color: #667eea;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
}

.card h3 {
  color: #4a5568;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

thead {
  background: #f7fafc;
}

th {
  text-align: left;
  padding: 0.75rem;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

tbody tr:hover {
  background: #f7fafc;
}

code {
  background: #f7fafc;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #e53e3e;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-right: 0.5rem;
}

.badge-pk {
  background: #fbd38d;
  color: #744210;
}

.badge-fk {
  background: #90cdf4;
  color: #2c5282;
}

.badge-unique {
  background: #9ae6b4;
  color: #22543d;
}

.badge-not-null {
  background: #fc8181;
  color: #742a2a;
}

.search-box {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-box:focus {
  outline: none;
  border-color: #667eea;
}

.table-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.table-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #667eea;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.table-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.table-card h3 {
  margin: 0 0 0.5rem 0;
}

.table-card a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
}

.table-card a:hover {
  color: #764ba2;
}

.table-card p {
  color: #718096;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.table-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #a0aec0;
}

footer {
  text-align: center;
  padding: 2rem 0;
  color: #718096;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .table-list {
    grid-template-columns: 1fr;
  }
  
  table {
    font-size: 0.9rem;
  }
  
  th, td {
    padding: 0.5rem;
  }
}
`;

function generateIndexPage(ast: NormalizedAST, outDir: string) {
    const tables = Object.keys(ast.targets).sort();
    const tableCards = tables.map(key => {
        const table = ast.targets[key];
        const columnCount = Object.keys(table.columns || {}).length;

        return `
      <div class="table-card">
        <h3><a href="tables/${key}.html">${escapeHtml(table.table)}</a></h3>
        <p>${escapeHtml(table.description || 'No description')}</p>
        <div class="table-meta">
          <span>📊 ${columnCount} columns</span>
          <span>🗄️ ${table.db}.${table.schema}</span>
        </div>
      </div>
    `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ast.project)} - Documentation</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <header>
    <div class="container">
      <h1>📚 ${escapeHtml(ast.project)}</h1>
      <p class="subtitle">Database Documentation & Data Lineage</p>
    </div>
  </header>

  <div class="container">
    <nav>
      <a href="index.html">🏠 Home</a>
      <a href="tables/index.html">📊 Tables</a>
      <a href="sources.html">🔌 Sources</a>
      <a href="mappings.html">🔗 Mappings</a>
    </nav>

    <div class="card">
      <h2>📊 Database Tables</h2>
      <input type="text" id="searchBox" class="search-box" placeholder="🔍 Search tables..." onkeyup="searchTables()">
      <div class="table-list" id="tableList">
        ${tableCards}
      </div>
    </div>

    <div class="card">
      <h2>📈 Statistics</h2>
      <p><strong>Total Tables:</strong> ${tables.length}</p>
      <p><strong>Total Sources:</strong> ${Object.keys(ast.sources).length}</p>
      <p><strong>Total Mappings:</strong> ${ast.mappings.length}</p>
    </div>
  </div>

  <footer>
    <p>Generated by <strong>DBDocManager</strong> | DSL-driven Documentation & Lineage Platform</p>
  </footer>

  <script>
    function searchTables() {
      const input = document.getElementById('searchBox');
      const filter = input.value.toLowerCase();
      const tableList = document.getElementById('tableList');
      const cards = tableList.getElementsByClassName('table-card');
      
      for (let i = 0; i < cards.length; i++) {
        const text = cards[i].textContent || cards[i].innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
          cards[i].style.display = '';
        } else {
          cards[i].style.display = 'none';
        }
      }
    }
  </script>
</body>
</html>
  `;

    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

function generateTablePage(key: string, table: any, ast: NormalizedAST, outDir: string) {
    const columns = Object.entries(table.columns || {});

    const columnRows = columns.map(([colName, col]: [string, any]) => {
        const constraints = [];
        if (col.pk) constraints.push('<span class="badge badge-pk">PK</span>');
        if (col.fk) constraints.push('<span class="badge badge-fk">FK</span>');
        if (col.unique) constraints.push('<span class="badge badge-unique">UNIQUE</span>');
        if (col.not_null) constraints.push('<span class="badge badge-not-null">NOT NULL</span>');

        // Find mapping for this column
        const mapping = ast.mappings.find(m =>
            m.target.db === table.db &&
            m.target.schema === table.schema &&
            m.target.table === table.table &&
            m.target.column === colName
        );

        let source = '-';
        if (mapping?.from?.source_id && mapping?.from?.path) {
            source = `<code>${escapeHtml(mapping.from.source_id)}:${escapeHtml(mapping.from.path)}</code>`;
        } else if (mapping?.from?.rule) {
            source = `<code>${escapeHtml(mapping.from.rule)}</code>`;
        }

        return `
      <tr>
        <td><strong>${escapeHtml(colName)}</strong></td>
        <td><code>${escapeHtml(col.type)}</code></td>
        <td>${constraints.join(' ')}</td>
        <td>${escapeHtml(col.description || '-')}</td>
        <td>${source}</td>
        <td>${col.default ? `<code>${escapeHtml(String(col.default))}</code>` : '-'}</td>
      </tr>
    `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(table.table)} - ${escapeHtml(ast.project)}</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <header>
    <div class="container">
      <h1>📊 ${escapeHtml(table.table)}</h1>
      <p class="subtitle">${escapeHtml(table.db)}.${escapeHtml(table.schema)}.${escapeHtml(table.table)}</p>
    </div>
  </header>

  <div class="container">
    <nav>
      <a href="../index.html">🏠 Home</a>
      <a href="index.html">📊 Tables</a>
      <a href="../sources.html">🔌 Sources</a>
      <a href="../mappings.html">🔗 Mappings</a>
    </nav>

    <div class="card">
      <h2>About</h2>
      <p><strong>Description:</strong> ${escapeHtml(table.description || 'No description')}</p>
      <p><strong>Owner:</strong> ${escapeHtml(table.owner || 'Not specified')}</p>
      <p><strong>Database:</strong> <code>${escapeHtml(table.db)}</code></p>
      <p><strong>Schema:</strong> <code>${escapeHtml(table.schema)}</code></p>
    </div>

    <div class="card">
      <h2>Columns</h2>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Constraints</th>
            <th>Description</th>
            <th>Mapped From</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          ${columnRows}
        </tbody>
      </table>
    </div>
  </div>

  <footer>
    <p>Generated by <strong>DBDocManager</strong></p>
  </footer>
</body>
</html>
  `;

    fs.writeFileSync(path.join(outDir, `${key}.html`), html, 'utf8');
}

function generateTableIndex(ast: NormalizedAST, outDir: string) {
    const tables = Object.keys(ast.targets).sort();

    const tableList = tables.map(key => {
        const table = ast.targets[key];
        const columnCount = Object.keys(table.columns || {}).length;
        return `
      <tr>
        <td><a href="${key}.html"><strong>${escapeHtml(table.table)}</strong></a></td>
        <td><code>${escapeHtml(table.db)}.${escapeHtml(table.schema)}</code></td>
        <td>${columnCount}</td>
        <td>${escapeHtml(table.description || '-')}</td>
      </tr>
    `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tables - ${escapeHtml(ast.project)}</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <header>
    <div class="container">
      <h1>📊 All Tables</h1>
      <p class="subtitle">${escapeHtml(ast.project)}</p>
    </div>
  </header>

  <div class="container">
    <nav>
      <a href="../index.html">🏠 Home</a>
      <a href="index.html">📊 Tables</a>
      <a href="../sources.html">🔌 Sources</a>
      <a href="../mappings.html">🔗 Mappings</a>
    </nav>

    <div class="card">
      <h2>All Tables</h2>
      <table>
        <thead>
          <tr>
            <th>Table Name</th>
            <th>Location</th>
            <th>Columns</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${tableList}
        </tbody>
      </table>
    </div>
  </div>

  <footer>
    <p>Generated by <strong>DBDocManager</strong></p>
  </footer>
</body>
</html>
  `;

    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

function generateSourcesPage(ast: NormalizedAST, outDir: string) {
    const sources = Object.entries(ast.sources);

    const sourceRows = sources.map(([id, source]: [string, any]) => {
        return `
      <tr>
        <td><code>${escapeHtml(id)}</code></td>
        <td><span class="badge" style="background: #bee3f8; color: #2c5282;">${escapeHtml(source.kind || 'unknown')}</span></td>
        <td>${source.db ? `<code>${escapeHtml(source.db)}</code>` : '-'}</td>
        <td>${source.collection ? `<code>${escapeHtml(source.collection)}</code>` : (source.table ? `<code>${escapeHtml(source.table)}</code>` : '-')}</td>
        <td>${escapeHtml(source.description || '-')}</td>
      </tr>
    `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sources - ${escapeHtml(ast.project)}</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🔌 Data Sources</h1>
      <p class="subtitle">${escapeHtml(ast.project)}</p>
    </div>
  </header>

  <div class="container">
    <nav>
      <a href="index.html">🏠 Home</a>
      <a href="tables/index.html">📊 Tables</a>
      <a href="sources.html">🔌 Sources</a>
      <a href="mappings.html">🔗 Mappings</a>
    </nav>

    <div class="card">
      <h2>All Data Sources</h2>
      <p>These are the source systems that feed data into your target tables.</p>
      <table>
        <thead>
          <tr>
            <th>Source ID</th>
            <th>Type</th>
            <th>Database</th>
            <th>Collection/Table</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${sourceRows}
        </tbody>
      </table>
    </div>
  </div>

  <footer>
    <p>Generated by <strong>DBDocManager</strong></p>
  </footer>
</body>
</html>
  `;

    fs.writeFileSync(path.join(outDir, 'sources.html'), html, 'utf8');
}

function generateMappingsPage(ast: NormalizedAST, outDir: string) {
    const mappingRows = ast.mappings.map((mapping: any) => {
        const target = `${mapping.target.db}.${mapping.target.schema}.${mapping.target.table}.${mapping.target.column}`;

        let source = '-';
        if (mapping.from?.source_id && mapping.from?.path) {
            source = `<code>${escapeHtml(mapping.from.source_id)}:${escapeHtml(mapping.from.path)}</code>`;
        } else if (mapping.from?.rule) {
            source = `<code>${escapeHtml(mapping.from.rule)}</code>`;
        } else if (mapping.from?.source_id) {
            source = `<code>${escapeHtml(mapping.from.source_id)}</code>`;
        }

        const transform = mapping.transform
            ? `<code>${escapeHtml(JSON.stringify(mapping.transform))}</code>`
            : '-';

        return `
      <tr>
        <td><code>${escapeHtml(target)}</code></td>
        <td>${source}</td>
        <td>${transform}</td>
        <td>${escapeHtml(mapping.notes || '-')}</td>
      </tr>
    `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mappings - ${escapeHtml(ast.project)}</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🔗 Data Mappings</h1>
      <p class="subtitle">${escapeHtml(ast.project)} - Source to Target Lineage</p>
    </div>
  </header>

  <div class="container">
    <nav>
      <a href="index.html">🏠 Home</a>
      <a href="tables/index.html">📊 Tables</a>
      <a href="sources.html">🔌 Sources</a>
      <a href="mappings.html">🔗 Mappings</a>
    </nav>

    <div class="card">
      <h2>All Source-to-Target Mappings</h2>
      <p>Complete lineage showing how source data flows into target columns.</p>
      <table>
        <thead>
          <tr>
            <th>Target Column</th>
            <th>Source</th>
            <th>Transform</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${mappingRows}
        </tbody>
      </table>
      <p style="margin-top: 1rem; color: #718096;">
        <strong>Total Mappings:</strong> ${ast.mappings.length}
      </p>
    </div>
  </div>

  <footer>
    <p>Generated by <strong>DBDocManager</strong></p>
  </footer>
</body>
</html>
  `;

    fs.writeFileSync(path.join(outDir, 'mappings.html'), html, 'utf8');
}

export function generateStaticSite(ast: NormalizedAST, outDir: string) {
    console.log('Generating static HTML documentation site...');

    // Create directory structure
    ensureDir(outDir);
    const tablesDir = path.join(outDir, 'tables');
    ensureDir(tablesDir);

    // Generate index page
    generateIndexPage(ast, outDir);
    console.log('✓ Generated index.html');

    // Generate table pages
    for (const [key, table] of Object.entries(ast.targets)) {
        generateTablePage(key, table, ast, tablesDir);
    }
    console.log(`✓ Generated ${Object.keys(ast.targets).length} table pages`);

    // Generate table index
    generateTableIndex(ast, tablesDir);
    console.log('✓ Generated tables/index.html');

    // Generate sources page
    generateSourcesPage(ast, outDir);
    console.log('✓ Generated sources.html');

    // Generate mappings page
    generateMappingsPage(ast, outDir);
    console.log('✓ Generated mappings.html');

    console.log(`\n✅ Static documentation site generated at: ${outDir}`);
    console.log(`   Open ${path.join(outDir, 'index.html')} in your browser`);
}
