// Security and Safe Mode tests for Sesi
// Run with: npx ts-node tests/security.test.ts

import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

declare var process: any;

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

async function runExpectError(name: string, source: string, expectedErrorSnippet: string, options?: { safeMode?: boolean; allowLocalFs?: boolean }): Promise<void> {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter(undefined, options);
    await interpreter.interpret(program);
    assert(name, false, 'Expected execution to fail but it succeeded');
  } catch (error: any) {
    const gotMessage = error.message || '';
    const hasSnippet = gotMessage.includes(expectedErrorSnippet);
    assert(name, hasSnippet, `Expected error containing "${expectedErrorSnippet}", got: "${gotMessage}"`);
  }
}

async function main() {
  console.log('=== Sesi Security Test Suite ===\n');

  // Test 1: Prototype Pollution via Member Expression
  console.log('1. Testing Prototype Pollution via MemberExpression');
  await runExpectError(
    'Block direct __proto__ member assignment',
    'let obj = {}\nobj.__proto__ = "polluted"',
    'Prototype pollution attempt blocked'
  );
  await runExpectError(
    'Block prototype member assignment',
    'let obj = {}\nobj.prototype = "polluted"',
    'Prototype pollution attempt blocked'
  );
  await runExpectError(
    'Block constructor member assignment',
    'let obj = {}\nobj.constructor = "polluted"',
    'Prototype pollution attempt blocked'
  );
  await runExpectError(
    'Block __defineGetter__ member assignment',
    'let obj = {}\nobj.__defineGetter__ = "polluted"',
    'Prototype pollution attempt blocked'
  );

  // Test 2: Prototype Pollution via Index Expression
  console.log('\n2. Testing Prototype Pollution via IndexExpression');
  await runExpectError(
    'Block dynamic __proto__ index assignment',
    'let obj = {}\nobj["__proto__"] = "polluted"',
    'Prototype pollution attempt blocked'
  );
  await runExpectError(
    'Block dynamic prototype index assignment',
    'let obj = {}\nobj["prototype"] = "polluted"',
    'Prototype pollution attempt blocked'
  );
  await runExpectError(
    'Block dynamic __lookupSetter__ index assignment',
    'let obj = {}\nobj["__lookupSetter__"] = "polluted"',
    'Prototype pollution attempt blocked'
  );

  // Test 3: Path Traversal Protection
  console.log('\n3. Testing Directory Traversal Safeguards');
  await runExpectError(
    'Block read_file with path traversal',
    'read_file("../../../etc/passwd")',
    'Path traversal detected'
  );
  await runExpectError(
    'Block write_file with path traversal',
    'write_file("../test.txt", "malicious")',
    'Path traversal detected'
  );
  await runExpectError(
    'Block make_dir with path traversal',
    'make_dir("../unsafe_dir")',
    'Path traversal detected'
  );

  // Test 4: Sesi Safe Mode Enforcement (env variables)
  console.log('\n4. Testing Sesi Safe Mode limits (SESI_SAFE_MODE=true)');
  process.env.SESI_SAFE_MODE = 'true';
  try {
    await runExpectError(
      'Block shell command exec in safe mode',
      'exec("echo 123")',
      'Security Violation: exec is disabled'
    );
    await runExpectError(
      'Block child process spawn in safe mode',
      'spawn("test.sesi")',
      'Security Violation: spawn is disabled'
    );
  } finally {
    process.env.SESI_SAFE_MODE = 'false';
  }

  // Test 5: Static Options Sandboxing (No environment variable dependency)
  console.log('\n5. Testing Static Programmatic Sandboxing Options');
  await runExpectError(
    'Block exec via static safeMode option (independent of env)',
    'exec("echo 123")',
    'Security Violation: exec is disabled',
    { safeMode: true }
  );
  await runExpectError(
    'Block spawn via static safeMode option (independent of env)',
    'spawn("test.sesi")',
    'Security Violation: spawn is disabled',
    { safeMode: true }
  );

  // Test 6: Automated Tool Call Protection
  console.log('\n6. Testing LLM Automated Tool Call Safeguards');
  await runExpectError(
    'Block automated LLM tool calls targeting exec',
    'tool_call(exec)("rm -rf /")',
    'Security Violation: Automated execution of sensitive tool "exec" is forbidden.',
    { safeMode: false } // Even if safeMode is explicitly disabled!
  );
  await runExpectError(
    'Block automated LLM tool calls targeting spawn',
    'tool_call(spawn)("malicious.sesi")',
    'Security Violation: Automated execution of sensitive tool "spawn" is forbidden.',
    { safeMode: false } // Even if safeMode is explicitly disabled!
  );
  await runExpectError(
    'Block custom tool alias targeting exec',
    'define_tool("shell", exec, "danger")\ntool_call(shell)("echo hacked")',
    'Security Violation: Automated execution of sensitive tool "exec" is forbidden.',
    { safeMode: false }
  );

  // Test 7: Gold-Standard Prototype Isolation
  console.log('\n7. Testing Gold-Standard Prototype Isolation');
  await runExpectError(
    'Verify Sesi object literal has no prototype constructor method',
    'let obj = {}; obj.constructor()',
    'Not a function'
  );
  await runExpectError(
    'Verify parsed JSON object has no prototype constructor method',
    'let parsed = from_json("{\\\"a\\\": 1}"); parsed.constructor()',
    'Not a function'
  );

  // Summary
  console.log(`\n=== Security Test Summary ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
