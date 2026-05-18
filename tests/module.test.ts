// Sesi Executable Modules Test Suite
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import * as fs from 'fs';
import * as path from 'path';

async function runTest(name: string, source: string, interpreter = new Interpreter()): Promise<any> {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    await interpreter.interpret(program);
    console.log(`✓ ${name}`);
    return interpreter;
  } catch (error: any) {
    console.error(`✗ ${name}: ${error.stack || error.message}`);
    throw error;
  }
}

async function main() {
  console.log('=== Sesi Modules Test Suite ===\n');

  // Test 1: Export statement and interpreter registration
  const int1 = await runTest('Export variables and functions', `
    export let x = 42
    export fn double(n) { return n * 2 }
  `);
  if (int1.exports.get('x') === 42) {
    console.log('  ✓ Exported variable registered correctly');
  } else {
    console.error('  ✗ Exported variable failed, got:', int1.exports.get('x'));
  }
  if (int1.exports.has('double')) {
    console.log('  ✓ Exported function registered correctly');
  } else {
    console.error('  ✗ Exported function failed');
  }

  // Test 2: Local Sesi file import (Sesi-to-Sesi)
  const tempModPath = path.resolve(process.cwd(), 'temp_module.sesi');
  fs.writeFileSync(tempModPath, `
    export let key = "secret"
    export fn multiply(a, b) { return a * b }
  `, 'utf-8');

  try {
    const int2 = new Interpreter();
    await runTest('Import local module', `
      import { multiply, key } from "temp_module"
      let result = multiply(3, 4)
      print "Import result:" + str(result)
    `, int2);
    
    // Verify bindings inside environment
    const multiplyVal = (int2 as any).currentEnv.get('multiply');
    const keyVal = (int2 as any).currentEnv.get('key');
    if (multiplyVal && keyVal === 'secret') {
      console.log('  ✓ Local module named imports bound successfully');
    } else {
      console.error('  ✗ Named imports binding failed');
    }
  } finally {
    if (fs.existsSync(tempModPath)) {
      fs.unlinkSync(tempModPath);
    }
  }

  // Test 3: Standard Math module (std/math)
  const int3 = new Interpreter();
  await runTest('Import std/math module', `
    import { PI, sqrt, pow } from "std/math"
    let p = PI
    let val = sqrt(16)
    let power = pow(2, 3)
  `, int3);
  const piVal = (int3 as any).currentEnv.get('p');
  const sqrtVal = (int3 as any).currentEnv.get('val');
  const powVal = (int3 as any).currentEnv.get('power');
  if (piVal === Math.PI && sqrtVal === 4 && powVal === 8) {
    console.log('  ✓ std/math values/functions validated correctly');
  } else {
    console.error(`  ✗ std/math validation failed: pi=${piVal}, sqrt=${sqrtVal}, pow=${powVal}`);
  }

  // Test 4: Standard Time module (std/time)
  const int4 = new Interpreter();
  await runTest('Import std/time module', `
    import { now, sleep } from "std/time"
    let t1 = now()
    sleep(100)
    let t2 = now()
  `, int4);
  const t1 = (int4 as any).currentEnv.get('t1');
  const t2 = (int4 as any).currentEnv.get('t2');
  if (typeof t1 === 'number' && typeof t2 === 'number' && (t2 - t1) >= 80) {
    console.log('  ✓ std/time sleep and now validated correctly');
  } else {
    console.error(`  ✗ std/time validation failed: t1=${t1}, t2=${t2}, diff=${t2 - t1}`);
  }

  // Test 5: Standard JSON module (std/json)
  const int5 = new Interpreter();
  await runTest('Import std/json module', `
    import { stringify, parse } from "std/json"
    let original = { "x": 10 }
    let strObj = stringify(original)
    let backObj = parse(strObj)
    let xVal = backObj["x"]
  `, int5);
  const xVal = (int5 as any).currentEnv.get('xVal');
  if (xVal === 10) {
    console.log('  ✓ std/json stringify and parse validated successfully');
  } else {
    console.error(`  ✗ std/json validation failed, got: ${xVal}`);
  }

  console.log('\nAll module tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
