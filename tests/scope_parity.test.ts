import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runDryRunSemanticChecks } from '../src/dry-checker';

const require = createRequire(import.meta.url);
const Module = require('node:module') as { _load: (...args: any[]) => any };
const originalLoad = Module._load;
Module._load = function (request: string, ...args: any[]) {
  if (request === 'vscode') return {};
  return originalLoad.call(this, request, ...args);
};
const ide = require('../editors/vscode/extension.js')._test;
Module._load = originalLoad;

function collectSesiFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSesiFiles(fullPath));
    else if (entry.name.endsWith('.sesi') && entry.name !== 'lint.sesi') files.push(fullPath);
  }
  return files;
}

function normalizedIdeDiagnostics(source: string) {
  const tokens = ide.tokenize(source);
  const { decls, refs } = ide.findDeclarationsAndReferences(tokens);
  return ide.analyzeScope(tokens, decls, refs).map((diagnostic: any) => ({
    severity: diagnostic.type,
    code: diagnostic.type === 'error' ? 'undefined-symbol' : 'unused-symbol',
    message: diagnostic.message,
    line: diagnostic.token.line + 1,
    column: diagnostic.token.col + 1,
  }));
}

const repositoryRoot = path.resolve(__dirname, '..');
const files = collectSesiFiles(repositoryRoot);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.deepEqual(
    runDryRunSemanticChecks(source),
    normalizedIdeDiagnostics(source),
    `--check scope diagnostics differ from the IDE for ${path.relative(repositoryRoot, file)}`
  );
}

console.log(`Scope checker parity tests passed for ${files.length} Sesi files.`);
