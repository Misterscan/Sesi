import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module') as { _load: (...args: any[]) => any };
const originalLoad = Module._load;
Module._load = function (request: string, ...args: any[]) {
  if (request === 'vscode') {
    return {
      Range: class { constructor(public start: any, public end: any) {} },
      Position: class { constructor(public line: number, public character: number) {} },
      Diagnostic: class { constructor(public range: any, public message: string, public severity: number) {} },
      DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    };
  }
  return originalLoad.call(this, request, ...args);
};
const ide = require('../editors/vscode/extension.js')._test;
Module._load = originalLoad;

const repositoryRoot = path.resolve(__dirname, '..');
const studioHtml = fs.readFileSync(path.join(repositoryRoot, 'sesi-studio', 'build', 'index.min.html'), 'utf8');
const studioServer = fs.readFileSync(path.join(repositoryRoot, 'sesi-studio', 'studio.sesi'), 'utf8');
const extensionSource = fs.readFileSync(path.join(repositoryRoot, 'editors', 'vscode', 'extension.js'), 'utf8');
assert.ok(extensionSource.match(/const docs = ({[\s\S]*?});\s*(?:let|const) hoverProvider/));
assert.ok(studioHtml.includes("'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'"));
assert.ok(studioHtml.includes("'atan2', 'cbrt', 'ceil', 'clz32'"));
assert.ok(studioServer.includes('!Safe.fileExists(query_path)'), 'Studio file API must reject nonexistent module candidates');
assert.ok(studioServer.includes('"exists": true'), 'Studio file API must identify successful reads');
const featureStart = studioHtml.indexOf('const sesiBuiltinModuleExports =');
const featureEnd = studioHtml.indexOf('// Configure Monaco theme', featureStart);
assert.ok(featureStart >= 0 && featureEnd > featureStart, 'Expected the bundled Sesi hover provider');
const featureSource = studioHtml.slice(featureStart, featureEnd);

let hoverProvider: any = null;
class Range {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number,
  ) {}
}
const monaco = {
  Range,
  languages: {
    registerHoverProvider(_language: string, provider: any) { hoverProvider = provider; },
  },
};
const safePath = 'helpers/safe.sesi';
const ansiPath = 'lib/ansi.sesi';
const packagePath = 'sesi_modules/demo/index.sesi';
const studioWindow: any = {
  activeFilePath: 'helpers/html-minify.sesi',
  workspaceRoot: '.',
  openFiles: {
    [safePath]: { content: fs.readFileSync(path.join(repositoryRoot, safePath), 'utf8') },
  },
  sesiTokenizer: ide.tokenize,
  sesiFindDecls: ide.findDeclarationsAndReferences,
  sesiAnalyzeScope: ide.analyzeScope,
  sesiGetModuleDocumentation: ide.getModuleDocumentation,
  sesiGetDeclarationDetails: ide.getDeclarationDetails,
  sesiFindExportDefinition: ide.findExportDefinitionInText,
  sesiGetImportTargetAtToken: ide.getImportTargetAtToken,
  sesiGetNamespaceImportAtToken: ide.getNamespaceImportAtToken,
  sesiGetMakeMemberTargetAtToken: ide.getMakeMemberTargetAtToken,
  sesiFindMakeMemberDefinition: ide.findMakeMemberDefinitionInText,
};
const workspaceFiles: Record<string, string> = {
  [ansiPath]: fs.readFileSync(path.join(repositoryRoot, ansiPath), 'utf8'),
  'helpers/accessibility.sesi': fs.readFileSync(path.join(repositoryRoot, 'helpers/accessibility.sesi'), 'utf8'),
  [packagePath]: `/** Demo package. */\nexport fn hello(name: string) -> string { return name }\n`,
};
const studioFetch = async (url: string) => {
  const encodedPath = String(url).split('path=')[1];
  if (!encodedPath) throw new Error(`Unexpected fetch: ${url}`);
  const requestedPath = decodeURIComponent(encodedPath);
  if (!Object.prototype.hasOwnProperty.call(workspaceFiles, requestedPath)) {
    return { ok: false, json: async () => ({ exists: false, path: requestedPath }) };
  }
  return {
    ok: true,
    json: async () => ({ exists: true, path: requestedPath, content: workspaceFiles[requestedPath] }),
  };
};
new Function('window', 'monaco', 'syntax', 'fetch', featureSource)(
  studioWindow,
  monaco,
  { docs: {} },
  studioFetch,
);
assert.ok(hoverProvider, 'Expected Studio to register its Sesi hover provider');

function createModel(source: string) {
  const lines = source.split('\n');
  return {
    getValue: () => source,
    getOffsetAt(position: { lineNumber: number; column: number }) {
      return lines.slice(0, position.lineNumber - 1).reduce((total, line) => total + line.length + 1, 0)
        + position.column - 1;
    },
    getWordAtPosition(position: { lineNumber: number; column: number }) {
      const line = lines[position.lineNumber - 1] || '';
      const index = position.column - 1;
      const matches = [...line.matchAll(/[a-zA-Z_]\w*/g)];
      const match = matches.find(item => item.index! <= index && index < item.index! + item[0].length);
      if (!match) return null;
      return { word: match[0], startColumn: match.index! + 1, endColumn: match.index! + match[0].length + 1 };
    },
  };
}

const model = createModel('allow "safe" in as safe\nshow safe.read("fixture.txt")\n');

async function main() {
  const mathModule = createModel('allow "std/math" in as Math\n');
  const mathModuleHover = await hoverProvider.provideHover(mathModule, { lineNumber: 1, column: 9 });
  assert.ok(mathModuleHover.contents[0].value.includes('SQRT2 (number)'));
  assert.ok(mathModuleHover.contents[0].value.includes('atan2(y, x)'));
  assert.ok(mathModuleHover.contents[0].value.includes('hypot(...values)'));

  const drawModule = createModel('allow "std/draw" in as Draw\n');
  const drawModuleHover = await hoverProvider.provideHover(drawModule, { lineNumber: 1, column: 9 });
  for (const name of [
    'pixel_rect', 'pixel_circle', 'pixel_line', 'pixel_ellipse', 'pixel_polygon', 'pixel_triangle',
    'pixel_star', 'pixel_ring', 'pixel_arc', 'pixel_bezier', 'pixel_text',
  ]) {
    assert.ok(drawModuleHover.contents[0].value.includes(`${name}(`), `Expected ${name} in std/draw hover`);
  }

  const moduleSpecifierHover = await hoverProvider.provideHover(model, { lineNumber: 1, column: 9 });
  assert.ok(moduleSpecifierHover.contents[0].value.includes('Safe File Access'));

  const namespaceHover = await hoverProvider.provideHover(model, { lineNumber: 2, column: 7 });
  assert.ok(namespaceHover.contents[0].value.includes('Safe File Access'));
  assert.ok(namespaceHover.contents[0].value.includes('**Exports:**'));

  const importedExportHover = await hoverProvider.provideHover(model, { lineNumber: 2, column: 12 });
  assert.ok(importedExportHover.contents[0].value.includes('fn read(path: string) -> string'));
  assert.ok(importedExportHover.contents.some((item: any) => item.value.includes('*Imported from:* `safe`')));

  const directImportModel = createModel('allow "safe" in with {read}\nshow read("fixture.txt")\n');
  const directImportHover = await hoverProvider.provideHover(directImportModel, { lineNumber: 2, column: 7 });
  assert.ok(directImportHover.contents[0].value.includes('fn read(path: string) -> string'));
  assert.ok(directImportHover.contents.some((item: any) => item.value.includes('*Imported from:* `safe`')));

  studioWindow.activeFilePath = 'examples/main/test-env.sesi';
  const rootModuleModel = createModel('allow "lib/ansi" in as TERM\nshow TERM.badge("KEY", "value")\n');
  const rootModuleHover = await hoverProvider.provideHover(rootModuleModel, { lineNumber: 1, column: 10 });
  assert.ok(
    rootModuleHover.contents[0].value.includes('Terminal Formatting Convenience Wrappers'),
    rootModuleHover.contents[0].value,
  );
  assert.ok(rootModuleHover.contents[0].value.includes('*Path:* `lib/ansi.sesi`'));

  const packageModel = createModel('allow "demo" in as Demo\nshow Demo.hello("Sesi")\n');
  const packageModuleHover = await hoverProvider.provideHover(packageModel, { lineNumber: 1, column: 9 });
  assert.ok(
    packageModuleHover.contents[0].value.includes('Demo package'),
    packageModuleHover.contents[0].value,
  );
  assert.ok(packageModuleHover.contents[0].value.includes('*Path:* `sesi_modules/demo/index.sesi`'));

  const packageExportHover = await hoverProvider.provideHover(packageModel, { lineNumber: 2, column: 12 });
  assert.ok(packageExportHover.contents[0].value.includes('fn hello(name: string) -> string'));
  assert.ok(packageExportHover.contents.some((item: any) => item.value.includes('*Imported from:* `demo`')));

  const localModel = createModel(`/// Adds two numbers.
async fn add(a: number, b: number = 1) -> number {
  return a + b
}
show add(2)
`);
  const localHover = await hoverProvider.provideHover(localModel, { lineNumber: 5, column: 7 });
  assert.ok(localHover.contents[0].value.includes('async fn add(a: number, b: number = 1) -> number'));
  assert.ok(localHover.contents.some((item: any) => item.value.replace(/\\/g, '').includes('Adds two numbers.')));

  studioWindow.activeFilePath = 'main/accessibility_demo.sesi';
  const makeMemberModel = createModel(`allow "helpers/accessibility" in with {Accessibility}
let a11y = Accessibility()
show a11y.preferences()
`);
  const makeMemberHover = await hoverProvider.provideHover(makeMemberModel, { lineNumber: 3, column: 13 });
  assert.ok(makeMemberHover.contents[0].value.includes('fn preferences(self) -> object'));
  assert.ok(makeMemberHover.contents.some((item: any) => item.value.replace(/\\/g, '').includes('Returns a snapshot of the current accessibility preferences.')));
  assert.ok(makeMemberHover.contents.some((item: any) => item.value.includes('*Member of:* `Accessibility`')));

  console.log('Sesi Studio hover tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
