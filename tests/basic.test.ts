// Basic test suite for Sesi
// Run with: npm test

import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import type { ModelCallExpression, ImageCallExpression, ExpressionStatement, ArrayLiteral, Literal, Identifier } from '../src/types';


async function runTest(name: string, source: string, expected?: any): Promise<void> {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter();
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
  await runTest('Range function', 'let arr = range(5)');
  await runTest('Push function', 'let arr = [1, 2]\npush(arr, 3)');
  await runTest('Pop function', 'let arr = [1, 2, 3]\nlet x = pop(arr)');
  await runTest('Join function', 'let s = join([1, 2, 3], "-")');
  await runTest('Split function', 'let arr = split("a,b,c", ",")');
  await runTest('Keys function', 'let k = keys({ "x": 1 })');
  await runTest('Values function', 'let v = values({ "x": 1 })');
  await runTest('Prompt expression', 'prompt test { "hello" }');
  await runTest('Nested blocks', '{ { print "nested" } }');
  await runTest('Variable shadowing', 'let x = 1\n{ let x = 2 }');
  await runTest('Break statement', 'while true { break }');
  await runTest('Continue statement', 'for i = 0 to 5 { if i == 2 { continue } }');
  await runTest('Try/Catch block', 'try { let x = missing_var } catch (e) { let y = "caught" }');
  await runTest('Unary negation', 'let x = -5');
  await runTest('Logical not', 'let x = !true');
  await runTest('Short-circuit AND', 'if false && true { }');
  await runTest('Short-circuit OR', 'if true || false { }');
  await runTest('Member access', 'let obj = { "x": { "y": 1 } }\nlet val = obj["x"]["y"]');
  await runTest('Default parameters', 'fn greet(name = "World") { print name }');
  await runTest('Return with value', 'fn test() { return 42 }');
  await runTest('Return without value', 'fn test() { return }');

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
    const expr = parseFirstExpr(`model("gemini-3.1-flash-lite") {images: "ref.jpg", temperature: 0, max_tokens: 256} {"analyze"}`) as ModelCallExpression;
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
    const expr = parseFirstExpr(`image("gemini-3.1-flash-image-preview") {images: "ref.jpg", ratio: "16:9"} {"render in same style"}`) as ImageCallExpression;
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
    assert('images field is absent', expr.images === undefined || expr.images === null);
  } catch (e: any) { console.error('  ✗ Parse threw:', e.message); failed++; }

  // ---------------------------------------------------------------------------
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
