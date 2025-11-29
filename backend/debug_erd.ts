
import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { normalize } from './src/parser';

const yamlPath = path.join(__dirname, '.dbdoc', 'retail_dw_multi_tables.yaml');
const yamlText = fs.readFileSync(yamlPath, 'utf8');

// Fix unquoted types with commas
const fixedYaml = yamlText.replace(/(type:\s*)([a-zA-Z0-9_]+\([0-9]+,\s*[0-9]+\))/g, '$1"$2"');
const parsed: any = YAML.load(fixedYaml);

const aggregated = {
    targets: parsed.targets || [],
    sources: parsed.sources || [],
    mappings: parsed.mappings || [],
};

const ast = normalize(aggregated);

console.log('--- AST Targets Keys ---');
console.log(Object.keys(ast.targets));

console.log('\n--- AST Targets Details ---');
console.log(JSON.stringify(ast.targets, null, 2));
