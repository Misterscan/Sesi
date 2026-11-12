import assert from 'node:assert/strict';
import { runDryRunSemanticChecks } from '../src/dry-checker';
import { literalModuleSpecifiers } from '../src/parser';
import { collectLiteralSesiModules, sourceGraphUsesGame } from '../src/game';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source = `
fn demo(used, ignored) {
  let local = used
  show missing_name
}

demo(1, 2)
`;

const diagnostics = runDryRunSemanticChecks(source);

assert.deepEqual(
  diagnostics.map(({ severity, code, line }) => ({ severity, code, line })),
  [
    { severity: 'error', code: 'undefined-symbol', line: 4 },
    { severity: 'warning', code: 'unused-symbol', line: 2 },
    { severity: 'warning', code: 'unused-symbol', line: 3 },
  ]
);

const cleanSource = `
fn double(value) {
  return value * 2
}
show double(4)
`;

assert.deepEqual(
  runDryRunSemanticChecks(cleanSource),
  []
);

const makeSource = `
make Person {
  let kind = "person"
  fn greet(self) {
    return "hello"
  }
}
let person = Person()
show person.greet()
`;

assert.deepEqual(
  runDryRunSemanticChecks(makeSource),
  []
);

const declarationFormsSource = `
// allow "missing/single-line-module" in as Missing
/*
allow "missing/block-module" in with {Thing}
show missing_from_comment
*/

allow "petLogic" in with {
  feed_pet,
  wash_pet
}

fn validate(value) {
  return value != null
}

define_tool("url_validator", validate, "Validates a value")
prompt request {"check this"}
let valid = tool_call(url_validator)(request)
if valid {
  show feed_pet wash_pet
}
`;

assert.deepEqual(
  runDryRunSemanticChecks(declarationFormsSource),
  []
);

const dynamicallyUsedToolsSource = `
fn getProfiles() {
  return []
}

fn renderImage(promptText) {
  return promptText
}

define_tool("get_profiles", getProfiles, "Get profiles")
define_tool("render_image", renderImage, "Render an image")
let answer = model("gemini-test") {tools: list_tools()} {"Use every available tool."}
show answer
`;

assert.deepEqual(
  runDryRunSemanticChecks(dynamicallyUsedToolsSource),
  []
);

// Strings must stay opaque in both the CLI and editor checkers.
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
let ide: any;
try {
  Module._load = function (request: string, ...args: any[]) {
    if (request === 'vscode') return {};
    return originalLoad.call(this, request, ...args);
  };
  ide = require('../editors/vscode/extension.js')._test;
} finally {
  Module._load = originalLoad;
}

for (const content of [
  'let fake = missing_name',
  'fn fake(parameter) { return missing_name }',
  'make Fake { let field = missing_name }',
  'if missing_name { show another_missing } else { show third_missing }',
  'while missing_name { break } for value in missing_name { continue }',
  'try { raise_error(missing_name) } catch (fake) { show fake }',
  'model(missing_name) {tools: list_tools()} {missing_prompt}',
  'export let fake = missing_name',
  'export fn fake(parameter) { return missing_name }',
  'export async fn fake(parameter) { return missing_name }',
  'prompt fake {missing_name} memory fake $MISSING_ENV',
  '// comment syntax /* and block syntax */ { } [ ] ( )',
  'allow "missing/module" in as Fake',
  'import { fake } from "missing/module"',
  "allow 'another/module' in with { fake }",
]) {
  for (const quote of ['"', "'"]) {
    const escaped = content.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`);
    for (const suffix of [quote, '', '\\']) {
      const text = `show ${quote}${escaped}${suffix}`;
      assert.deepEqual(runDryRunSemanticChecks(text), [], text);
      if (suffix === quote) assert.deepEqual(literalModuleSpecifiers(text), [], text);
      const tokens = ide.tokenize(text);
      assert.deepEqual(tokens.map((token: any) => token.type), ['SHOW', 'STRING'], text);
      assert.deepEqual(ide.getModuleSpecifiers(text), [], text);
      assert.deepEqual(ide.getExportsFromSesiFile(null, text), [], text);
      assert.deepEqual(ide.getExportNamesFromSesiSource(text), [], text);
      const { decls, refs } = ide.findDeclarationsAndReferences(tokens);
      assert.deepEqual(decls, [], text);
      assert.deepEqual(refs, [], text);
    }
  }
}

const multiline = `show 'example text\nlet fake = missing_name\nallow "missing/module" in as Fake'\nshow real_missing`;
const exportExamples = `
show 'export let fake = 1'
show "export fn fake_function(value) {}"
// export let commented = 1
/** export fn commented_function() {} */
export let actual = 1
export async fn real_function(value = nested(1, 2)) { return value }
`;
assert.deepEqual(ide.getExportsFromSesiFile(null, exportExamples), [
  { type: 'variable', name: 'actual' },
  { type: 'function', name: 'real_function', params: 'value = nested(1, 2)', isAsync: true },
]);
assert.deepEqual(ide.getExportNamesFromSesiSource(exportExamples), ['actual', 'real_function']);
const multilineDiagnostics = runDryRunSemanticChecks(multiline);
assert.equal(multilineDiagnostics.length, 1);
assert.match(multilineDiagnostics[0].message, /real_missing/);
assert.equal(multilineDiagnostics[0].line, 4);
assert.deepEqual(ide.getModuleSpecifiers(multiline), []);
for (const module of ['std/math', 'std/game', 'builtins', './local/module', '/absolute/module']) {
  for (const text of [`allow "${module}" in as Real`, `import { value } from "${module}"`, `import value from "${module}"`]) {
    assert.deepEqual(literalModuleSpecifiers(text), [module]);
    assert.deepEqual(ide.getModuleSpecifiers(text).map((item: any) => item.specifier), [module]);
  }
}
assert.ok(runDryRunSemanticChecks(`show 'let fake = 1'\nshow fake`).some(item => item.code === 'undefined-symbol'));
assert.ok(runDryRunSemanticChecks(`fn demo() {\nlet unused = 1\nshow 'unused'\n}\ndemo()`).some(item => item.code === 'unused-symbol'));

// Exercise file detection as well as in-memory analysis.
const { scanLiteralModules } = require('../packages/sesi-game/index.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-module-detection-'));
const entry = path.join(temporary, 'entry.sesi');
const dependency = path.join(temporary, 'metadata.sesi');
function detect(text: string): boolean {
  fs.writeFileSync(entry, text);
  const result = sourceGraphUsesGame(entry);
  assert.equal(scanLiteralModules(entry), result, 'add-on and core should agree');
  return result;
}
try {
  for (const text of [
    `show 'Example: allow "std/game" in as Game'`,
    `show "Example: allow 'std/game' in as Game"`,
    `show 'Example:\nimport { create } from "std/game"\nEnd'`,
    `// allow "std/game" in as Game\nshow 1`,
    `/** import { create } from "std/game" */\nshow 1`,
    `let metadata = {signature: 'allow "std/game" in as Game'}`,
    `show 'allow "./missing-module" in as Example'`,
  ]) {
    assert.equal(detect(text), false, text);
    assert.deepEqual(collectLiteralSesiModules(entry), [entry]);
  }
  for (const text of [
    `allow "std/game" in as Game`,
    `allow 'std/game' in with { create }`,
    `import { create } from "std/game"`,
    `import create from "std/game"`,
    `allow /** module */ "std/game" in as Game`,
    `import {\ncreate\n} from\n"std/game"`,
    `fn start() {\nallow "std/game" in as Game\n}`,
  ]) assert.equal(detect(text), true, text);

  fs.writeFileSync(dependency, `export let BUILTINS = {Game: {signature: 'allow "std/game" in as Game'}}`);
  assert.equal(detect(`allow "./metadata" in with { BUILTINS }\nshow BUILTINS | keys`), false);
  assert.deepEqual(collectLiteralSesiModules(entry), [entry, dependency]);
  fs.writeFileSync(dependency, `allow "./entry" in as Entry\nallow "std/game" in as Game`);
  assert.equal(sourceGraphUsesGame(entry), true);
  assert.deepEqual(collectLiteralSesiModules(entry), [entry, dependency]);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('Dry-run semantic checker and string isolation tests passed.');
