// Basic test suite for Sesi
// Run with: npm test

import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import * as fs from 'fs';
import * as path from 'path';
import { inflateSync } from 'zlib';
import type { ModelCallExpression, ImageCallExpression, ExpressionStatement, ArrayLiteral, Literal, Identifier } from '../src/types';
import { SesiRuntimeError } from '../src/types';

declare var process: any;

async function runTest(name: string, source: string, expected?: any, options?: { safeMode?: boolean; allowLocalFs?: boolean }): Promise<void> {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter(undefined, options);
    await interpreter.interpret(program);
    console.log(`✓ ${name}`);
  } catch (error: any) {
    console.error(`✗ ${name}: ${error.stack || error.message}`);
  }
}

async function main() {
  console.log('Running Sesi test suite...\n');

  // Lexer tests
  console.log('=== Lexer Tests ===');

  const lexer1 = new Lexer('let x = 10');
  const tokens1 = lexer1.scanTokens();
  if (tokens1[0].type === 'LET') {
    console.log('✓ Keyword tokenization');
  }

  const lexer2 = new Lexer('"hello"');
  const tokens2 = lexer2.scanTokens();
  if (tokens2[0].type === 'STRING' && tokens2[0].literal === 'hello') {
    console.log('✓ String tokenization');
  }

  const lexer3 = new Lexer('42');
  const tokens3 = lexer3.scanTokens();
  if (tokens3[0].type === 'NUMBER' && tokens3[0].literal === 42) {
    console.log('✓ Number tokenization');
  }

  const makeTokens = new Lexer('make Person {}').scanTokens();
  if (makeTokens[0].type !== 'MAKE') {
    throw new Error('make must tokenize as a declaration keyword');
  }
  console.log('✓ Make keyword tokenization');

  const reservedWords = ['prompt', 'make'];
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    for (const word of reservedWords) {
      const parser = new Parser(new Lexer(`let ${word} = 1`).scanTokens());
      parser.parse();
      if (parser.errors.length === 0) {
        throw new Error(`${word} must be rejected as a reserved binding name`);
      }
    }
  } finally {
    console.error = originalConsoleError;
  }
  console.log('✓ Prompt and make reserved binding names');

  // Parser tests
  console.log('\n=== Parser Tests ===');

  const source1 = 'let x = 10';
  const parser1 = new Parser(new Lexer(source1).scanTokens());
  const program1 = parser1.parse();
  if (program1.statements[0].type === 'LetStatement') {
    console.log('✓ Parse let statement');
  }

  const source2 = 'fn add(a, b) { return a + b }';
  const parser2 = new Parser(new Lexer(source2).scanTokens());
  const program2 = parser2.parse();
  if (program2.statements[0].type === 'FunctionStatement') {
    console.log('✓ Parse function statement');
  }

  // Interpreter tests
  console.log('\n=== Interpreter Tests ===');

  await runTest('Variable declaration', 'let x = 10');
  await runTest('Variable assignment', 'let x = 10\nx = 20');
  await runTest('Print function', 'print "Hello"');
  await runTest('Arithmetic', 'let x = 10 + 20');
  await runTest('String concatenation', 'let x = "Hello" + " " + "World"');
  await runTest('Boolean operations', 'let x = true && false');
  await runTest('Comparison', 'let x = 10 > 5');
  await runTest('If statement', 'if true { print "yes" }');
  await runTest('If-else statement', 'if false { print "no" } else { print "yes" }');
  await runTest('While loop', 'let i = 0\nwhile i < 3 { i = i + 1 }');
  await runTest('For loop', 'for i = 0 to 3 { print i }');
  await runTest('For-in loop', 'for x in [1, 2, 3] { print x }');
  await runTest('Function definition', 'fn add(a, b) { return a + b }');
  await runTest('Function call', 'fn add(a, b) { return a + b }\nlet x = add(5, 3)');
  await runTest('Array literal', 'let arr = [1, 2, 3]');
  await runTest('Multi-line array literal', 'let arr = [\n  1,\n  2,\n  3\n]');
  await runTest('Array indexing', 'let arr = [1, 2, 3]\nlet x = arr[0]');
  await runTest('Array length', 'let arr = [1, 2, 3]\nlet len = len(arr)');
  await runTest('Object literal', 'let obj = { "x": 10 }');
  await runTest('Multi-line object literal', 'let obj = {\n  "readme.txt": "This is a mock document.",\n  "data.json": "{\\"status\\": \\"active\\"}"\n}');
  await runTest('Object access', 'let obj = { "x": 10 }\nlet val = obj["x"]');
  await runTest('Type function', 'let t = type(42)');
  await runTest('String function', 'let s = str(42)');
  await runTest('Number function', 'let n = num("42")');
  await runTest('Float function', 'let n = float("42.5")\nif n != 42.5 { let err = missing_var }');
  await runTest('Range function', 'let arr = range(5)');
  await runTest(
    'Native matrix multiplication',
    'let result = matrix_dot([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]])\nif result[0][0] != 58 || result[0][1] != 64 || result[1][0] != 139 || result[1][1] != 154 { raise_error("AssertionError", "matrix_dot result mismatch") }',
  );
  await runTest(
    'Native matrix broadcast addition',
    'let result = matrix_add([[1, 2], [3, 4]], [[10, 20]])\nif result[0][0] != 11 || result[0][1] != 22 || result[1][0] != 13 || result[1][1] != 24 { raise_error("AssertionError", "matrix_add broadcast mismatch") }',
  );
  await runTest(
    'Native matrix operations',
    'let a = [[1, 2], [3, 4]]\nlet t = matrix_transpose(a)\nlet s = matrix_scale(a, 0.5)\nlet e = matrix_mul_elements(a, a)\nlet rows = matrix_sum_rows(a)\nlet mse = matrix_mse(a, [[1, 1], [3, 3]])\nif t[0][1] != 3 || s[1][1] != 2 || e[1][0] != 9 || rows[0][1] != 6 || mse != 0.5 { raise_error("AssertionError", "native matrix operation mismatch") }',
  );
  await runTest('Env function retrieve all', 'let envs = env()\nif type(envs) != "object" { let err = missing_var }');
  await runTest('Env function retrieve specific', 'let val = env("PATH")\nif type(val) != "string" { let err = missing_var }');
  await runTest('Env function default value', 'let val = env("NON_EXISTENT_VAR", "default_val")\nif val != "default_val" { let err = missing_var }');
  await runTest('Push function', 'let arr = [1, 2]\npush(arr, 3)');
  await runTest('Append function (array)', 'let arr = [1, 2]\nappend(arr, 3)\nif len(arr) != 3 || arr[2] != 3 { let err = missing_var }');
  await runTest('Append function (string)', 'let s = append("Hello", " world")\nif s != "Hello world" { let err = missing_var }');
  await runTest('Pop function', 'let arr = [1, 2, 3]\nlet x = pop(arr)');
  await runTest('Join function', 'let s = join([1, 2, 3], "-")');
  await runTest('Split function', 'let arr = split("a,b,c", ",")');
  await runTest('Tokenize function (model token IDs)', 'let t = tokenize("  SesiLanguage, and rocks!  ")\nif len(t) < 3 || type(t[0]) != "number" { let err = missing_var }');
  await runTest('Tokenize function (simple mode)', 'let t = tokenize("  Sesi   language   rocks  ", "simple")\nif len(t) != 3 || t[0] != "Sesi" || t[2] != "rocks" { let err = missing_var }');
  await runTest('Tokenize function (current GPT model)', 'let t = tokenize("hello world", {"model": "gpt-5.6-sol"})\nif len(t) < 2 || type(t[0]) != "number" { let err = missing_var }');
  await runTest('Upper function', 'let s = to_upper("hello")\nif s != "HELLO" { let err = missing_var }');
  await runTest('Lower function', 'let s = to_lower("WORLD")\nif s != "world" { let err = missing_var }');
  await runTest('Trim function', 'let s = trim("  spaces  ")\nif s != "spaces" { let err = missing_var }');
  await runTest('Slice string function', 'let s = slice("abcdef", 1, 4)\nif s != "bcd" { let err = missing_var }');
  await runTest('Slice array function', 'let arr = slice([10, 20, 30, 40], 2)\nif len(arr) != 2 || arr[0] != 30 { let err = missing_var }');
  await runTest('Replace function', 'let s = swap("a_b_c", "_", "-")\nif s != "a-b-c" { let err = missing_var }');
  await runTest('Keys function', 'let k = keys({ "x": 1 })');
  await runTest('Values function', 'let v = values({ "x": 1 })');
  await runTest('Prompt expression', 'prompt test { "hello" }');
  await runTest('Make class construction and bound methods', 'make Person {\nlet kind = "person"\nfn start(self, name) { self.name = name }\nfn greet(self) { return "Hello, " + self.name }\n}\nlet ada = Person("Ada")\nif ada.kind != "person" || ada.name != "Ada" || ada.greet() != "Hello, Ada" { raise_error("AssertionError", "make instance failed") }');
  await runTest('Make instances have independent state','make Counter {\nlet count = 0\nfn increment(self) {\nself.count = self.count + 1\nreturn self.count\n}\n}\nlet first = Counter()\nlet second = Counter()\nfirst.increment()\nif first.count != 1 || second.count != 0 { raise_error("AssertionError", "make instances share state") }');
  await runTest('Make start constructor supports defaults','make User {\nfn start(self, name, role = "member") {\nself.name = name\nself.role = role\n}\n}\nlet user = User("Ada")\nif user.name != "Ada" || user.role != "member" { raise_error("AssertionError", "start failed") }');
  await runTest('Nested blocks', '{ { print "nested" } }');
  await runTest('Variable shadowing', 'let x = 1\n{ let x = 2 }');
  await runTest('Break statement', 'while true { break }');
  await runTest('Continue statement', 'for i = 0 to 5 { if i == 2 { continue } }');
  await runTest('Try/Catch block', 'try { let x = missing_var } catch (e) { let y = "caught" }');
  await runTest('Try/Catch/Finally block (try path)','let x = 0\ntry { x = 1 } catch (e) { x = 2 } finally { x = 3 }\nif x != 3 { let y = missing_var }');
  await runTest('Try/Catch/Finally block (catch path)','let x = 0\ntry { let y = missing_var } catch (e) { x = 2 } finally { x = 3 }\nif x != 3 { let z = missing_var }');
  await runTest('Try/Catch/Finally block (return path)','let done = false\nfn f() { try { return 1 } catch (e) { return 2 } finally { done = true } }\nlet r = f()\nif r != 1 { let e = missing_var }\nif !done { let e2 = missing_var }');
  await runTest('Custom error types via raise_error(type, message, data)','try { raise_error("ValidationError", "Invalid field", {"field": "email"}) } catch (e) { if e["type"] != "ValidationError" { let x = missing_var } if e["message"] != "Invalid field" { let y = missing_var } if e["data"]["field"] != "email" { let z = missing_var } }');
  await runTest('Custom error types via error_type object','let err = error_type("RateLimit", "Too many requests", {"retryIn": 30})\ntry { raise_error(err) } catch (e) { if e["type"] != "RateLimit" { let a = missing_var } if e["data"]["retryIn"] != 30 { let b = missing_var } }');
  await runTest('Unary negation', 'let x = -5');
  await runTest('Logical not', 'let x = !true');
  await runTest('Short-circuit AND', 'if false && true { }');
  await runTest('Short-circuit OR', 'if true || false { }');
  await runTest('Member access', 'let obj = { "x": { "y": 1 } }\nlet val = obj["x"]["y"]');
  await runTest('Default parameters', 'fn greet(name = "World") { print name }');
  await runTest('Custom tool definitions','fn summarize(x) { return "ok:" + x }\ndefine_tool("summarizer", summarize, "Summarize text")\nlet out = tool_call(summarizer)("hello")\nif out != "ok:hello" { let e = missing_var }');
  await runTest('List custom tools','fn analyze(x) { return x }\ndefine_tool("analyzer", analyze)\nlet tools = list_tools()\nif len(tools) < 1 { let e = missing_var }');
  await runTest('Return with value', 'fn test() { return 42 }');
  await runTest('Return without value', 'fn test() { return }');
  await runTest('Audio std library keys check', 'allow "std/audio" in with Audio\nlet found = false\nfor k in keys(Audio) {\n  if k == "midi" { found = true }\n}\nif !found { raise_error("AssertionError", "midi missing") }');
  await runTest('Draw std library keys check', 'allow "std/draw" in with Draw\nlet found = false\nfor k in keys(Draw) {\n  if k == "save_svg" { found = true }\n}\nif !found { raise_error("AssertionError", "save_svg missing") }');
  const pngFixture = path.join(process.cwd(), 'tests', '.draw_pixel_fixture.png');
  try {
    const pixelSource = 'allow "std/draw" in with Draw\nDraw.pixel_grid(["AB", "BA"], {"A": "#ff00aa", "B": "#00ff00"}, 2, 1, 0)\nDraw.save_png("tests/.draw_pixel_fixture.png", 5, 4)';
    const pixelProgram = new Parser(new Lexer(pixelSource).scanTokens()).parse();
    await new Interpreter(undefined, { safeMode: false, allowLocalFs: true }).interpret(pixelProgram);
    const png = fs.readFileSync(pngFixture);
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('invalid PNG signature');
    if (png.readUInt32BE(16) !== 5 || png.readUInt32BE(20) !== 4) throw new Error('invalid PNG dimensions');
    const idat: Buffer[] = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const raster = inflateSync(Buffer.concat(idat));
    if (!raster.subarray(5, 9).equals(Buffer.from([255, 0, 170, 255]))) throw new Error('scaled palette pixel missing');
    if (!raster.subarray(13, 17).equals(Buffer.from([0, 255, 0, 255]))) throw new Error('grid palette mapping missing');
    console.log('✓ Draw raster pixel-grid PNG rendering');
  } catch (error: any) {
    console.error(`✗ Draw raster pixel-grid PNG rendering: ${error.stack || error.message}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(pngFixture, { force: true });
  }
  const checkOnlyFixture = path.join(process.cwd(), 'tests', '.sesi_check_only_fixture.sesi');
  fs.writeFileSync(checkOnlyFixture, 'raise_error("AssertionError", "checkOnly must not execute this file")');
  try {
    await runTest(
      'Sesi builtin compile-only mode',
      'let result = sesi("tests/.sesi_check_only_fixture.sesi", true, true)\nif result != "✓ Syntax and Compilation valid" { raise_error("AssertionError", "unexpected check-only result") }',
      undefined,
      { safeMode: false, allowLocalFs: true }
    );
  } finally {
    fs.rmSync(checkOnlyFixture, { force: true });
  }
  await runTest(
    'Python builtin execution and return value',
    'let out = python("print(\'hello\')")\nif out != "hello\\n" { raise_error("AssertionError", "expected hello\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'Python builtin argument passing (SESI_ARGS)',
    'let out = python("import os, json; args = json.loads(os.environ[\'SESI_ARGS\']); print(args[0])", [42])\nif out != "42\\n" { raise_error("AssertionError", "expected 42\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'Python builtin argument passing (sys.argv)',
    'let out = python("import sys; print(sys.argv[1])", ["hello"])\nif out != "hello\\n" { raise_error("AssertionError", "expected hello\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'JavaScript builtin execution and return value',
    'let out = js("console.log(\'hello\')")\nif out != "hello\\n" { raise_error("AssertionError", "expected hello\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'JavaScript builtin argument passing (SESI_ARGS)',
    'let out = js("const args = JSON.parse(process.env.SESI_ARGS); console.log(args[0])", [42])\nif out != "42\\n" { raise_error("AssertionError", "expected 42\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'JavaScript builtin argument passing (process.argv)',
    'let out = js("console.log(process.argv[2])", ["hello"])\nif out != "hello\\n" { raise_error("AssertionError", "expected hello\\\\n") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'JavaScript builtin process.stdout.write output',
    'let out = js("process.stdout.write(\'metadata\')")\nif out != "metadata" { raise_error("AssertionError", "expected raw stdout output") }',
    undefined,
    { safeMode: false }
  );
  await runTest(
    'HTML builtin wraps body content',
    'let page = html("<main>Hello</main>", {"title": "Demo"})\nif !contains(page, "<!DOCTYPE html>") { raise_error("AssertionError", "missing doctype") }\nif !contains(page, "<title>Demo</title>") { raise_error("AssertionError", "missing title") }\nif !contains(page, "<main>Hello</main>") { raise_error("AssertionError", "missing body") }',
  );

  const appendFileFixture = path.join(process.cwd(), 'tests', '.append_file_fixture.txt');
  try {
    await runTest(
      'append_file and read_file base64 mode',
      'write_file("tests/.append_file_fixture.txt", "Hello")\nappend_file("tests/.append_file_fixture.txt", " world")\nlet txt = read_file("tests/.append_file_fixture.txt")\nif txt != "Hello world" { raise_error("AssertionError", "text append failed") }\nlet b64 = read_file("tests/.append_file_fixture.txt", "base64")\nif b64 != "SGVsbG8gd29ybGQ=" { raise_error("AssertionError", "base64 mode failed") }\nlet invalid = read_file("tests/.append_file_fixture.txt", "bytes")\nif invalid != null { raise_error("AssertionError", "invalid mode should return null") }',
      undefined,
      { safeMode: false, allowLocalFs: true }
    );
  } finally {
    fs.rmSync(appendFileFixture, { force: true });
  }

  console.log('\n=== Summary ===');
  console.log('All basic tests completed!');
  console.log('Note: AI feature tests require GEMINI_API_KEY environment variable');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string): void {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  function parseFirstExpr(src: string): any {
    const tokens = new Lexer(src).scanTokens();
    const program = new Parser(tokens).parse();
    return (program.statements[0] as ExpressionStatement).expression;
  }

  console.log('\n=== Image Input — Parser / AST Tests ===\n');

  // 1. model() with a literal string images key
  console.log('1. model() — literal string path');
  try {
    const expr = parseFirstExpr(`model("gemini-3-flash-preview") {images: "docs/logo.png"} {"describe it"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('images field is present', expr.images !== undefined);
    const imgNode = expr.images as Literal;
    assert('images is a string literal', imgNode.type === 'Literal' && imgNode.rawType === 'string');
    assert('images value matches path', imgNode.value === 'docs/logo.png');
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 2. model() with an images variable (identifier)
  console.log('\n2. model() — identifier path');
  try {
    const expr = parseFirstExpr(`model("gemini-3-flash-preview") {images: myPath} {"describe it"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('images field is present', expr.images !== undefined);
    const imgNode = expr.images as Identifier;
    assert('images is an Identifier', imgNode.type === 'Identifier');
    assert('images identifier name matches', imgNode.name === 'myPath');
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 3. model() with an array of paths
  console.log('\n3. model() — array of paths');
  try {
    const expr = parseFirstExpr(`model("gemini-3-flash-preview") {images: ["a.png", "b.png"]} {"compare"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('images field is present', expr.images !== undefined);
    const arr = expr.images as ArrayLiteral;
    assert('images is an ArrayLiteral', arr.type === 'ArrayLiteral');
    assert('array has two elements', arr.elements.length === 2);
    assert('first element is a.png', (arr.elements[0] as Literal).value === 'a.png');
    assert('second element is b.png', (arr.elements[1] as Literal).value === 'b.png');
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 4. model() with images + other config keys
  console.log('\n4. model() — images mixed with temperature and max_tokens');
  try {
    const expr = parseFirstExpr(`model("gemini-3.5-flash-lite") {images: "ref.jpg", temperature: 0, max_tokens: 256} {"analyze"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('images field is present', expr.images !== undefined);
    assert('config.temperature is present', expr.config?.temperature !== undefined);
    assert('config.max_tokens is present', expr.config?.max_tokens !== undefined);
    const imgNode = expr.images as Literal;
    assert('images value is ref.jpg', imgNode.value === 'ref.jpg');
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 5. image() with a literal images key
  console.log('\n5. image() — literal reference path');
  try {
    const expr = parseFirstExpr(`image("gemini-3.1-flash-image-lite") {images: "ref.jpg", ratio: "16:9"} {"render in same style"}`) as ImageCallExpression;
    assert('type is ImageCallExpression', expr.type === 'ImageCallExpression');
    assert('images field is present', expr.images !== undefined);
    assert('config.ratio is present', expr.config?.ratio !== undefined);
    const imgNode = expr.images as Literal;
    assert('images value matches', imgNode.value === 'ref.jpg');
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 6. model() without images — field should be absent / undefined
  console.log('\n6. model() — no images key (backward-compat)');
  try {
    const expr = parseFirstExpr(`model("gemini-3-flash-preview") {"temperature": 0.3} {"hello"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('images field is absent', expr.images === undefined);
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // 7. model() with search parameter
  console.log('\n7. model() — shorthand search parameter');
  try {
    const expr = parseFirstExpr(`model("gemini-3-flash-preview") {search} {"hello"}`) as ModelCallExpression;
    assert('type is ModelCallExpression', expr.type === 'ModelCallExpression');
    assert('config.search is present', expr.config?.search !== undefined);
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // ---------------------------------------------------------------------------
  console.log('\n=== Diagnostics & String Semantics Tests ===\n');

  // 8. strict unknown escape sequences should fail with location
  console.log('8. lexer — invalid escape sequence');
  try {
    new Lexer('let x = "bad\\qescape"').scanTokens();
    assert('invalid escape should throw', false, 'lexer did not throw');
  } catch (e: any) {
    assert('reports unknown escape sequence', String(e.message).includes('Unknown escape sequence'));
    assert('reports line and column', /line\s+\d+,\s+column\s+\d+/i.test(String(e.message)));
  }

  // 9. multiline strings should remain supported
  console.log('\n9. lexer — multiline string support');
  try {
    const tokens = new Lexer('let poem = "line1\nline2"').scanTokens();
    const stringToken = tokens.find(t => t.type === 'STRING');
    assert('string token exists', !!stringToken);
    assert('multiline literal contains newline', String(stringToken?.literal).includes('\n'));
  } catch (e: any) { console.error('  ✗ Lexer threw:', e.message); failed++; }

  // 10. parser diagnostics should include line+column
  console.log('\n10. parser — error location includes column');
  const originalError = console.error;
  const parserMessages: string[] = [];
  console.error = (...args: any[]) => {
    parserMessages.push(args.map(a => String(a)).join(' '));
  };
  try {
    new Parser(new Lexer('let x =').scanTokens()).parse();
  } finally {
    console.error = originalError;
  }
  const combinedParserMessage = parserMessages.join(' | ');
  assert('parser emitted diagnostics', parserMessages.length > 0);
  assert('mentions line', combinedParserMessage.includes('line'));
  assert('mentions column', combinedParserMessage.includes('column'));

  // 11. runtime errors should carry stack context and location
  console.log('\n11. interpreter — runtime context stack');
  try {
    const source = 'fn boom() { let y = missing_var }\nfn caller() { boom() }\ncaller()';
    const interpreter = new Interpreter();
    const program = new Parser(new Lexer(source).scanTokens()).parse();
    await interpreter.interpret(program);
    assert('runtime error should throw', false, 'interpreter did not throw');
  } catch (e: any) {
    assert('throws SesiRuntimeError', e instanceof SesiRuntimeError);
    assert('has runtime line number', typeof e.line === 'number');
    assert('has stack trace frames', Array.isArray(e.stackTrace) && e.stackTrace.length > 0);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
