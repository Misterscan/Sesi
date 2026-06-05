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
    import { now, sleep, format } from "std/time"
    let t1 = now()
    sleep(100)
    let t2 = now()
    let formatted = format(t1, { "timeZone": "UTC" })
  `, int4);
  const t1 = (int4 as any).currentEnv.get('t1');
  const t2 = (int4 as any).currentEnv.get('t2');
  const formatted = (int4 as any).currentEnv.get('formatted');
  if (typeof t1 === 'number' && typeof t2 === 'number' && (t2 - t1) >= 80 && typeof formatted === 'string' && formatted.length > 0) {
    console.log('  ✓ std/time sleep, now, and format validated correctly');
  } else {
    console.error(`  ✗ std/time validation failed: t1=${t1}, t2=${t2}, diff=${t2 - t1}, formatted=${formatted}`);
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

  // Test 6: Standard Database module (std/db)
  const tempDbPath = path.resolve(process.cwd(), 'temp_test.db');
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
  try {
    const int6 = new Interpreter();
    await runTest('Import std/db module', `
      import { db_open } from "std/db"
      let db = db_open("temp_test.db")
      let users = db.collection("users")
      
      // Test insert
      let doc1 = users.insert({ "name": "Alice", "age": 30 })
      let doc2 = users.insert({ "name": "Bob", "age": 25 })
      
      // Test find
      let allUsers = users.find()
      let alice = users.find({ "name": "Alice" })
      
      // Test update
      let updatedCount = users.update({ "name": "Bob" }, { "age": 26 })
      let bobUpdated = users.find({ "name": "Bob" })
      let bobAge = bobUpdated[0]["age"]
      
      // Test delete
      let deletedCount = users.delete({ "name": "Alice" })
      let remainingUsers = users.find()
    `, int6);

    const doc1Val = (int6 as any).currentEnv.get('doc1');
    const allUsersVal = (int6 as any).currentEnv.get('allUsers');
    const aliceVal = (int6 as any).currentEnv.get('alice');
    const updatedCountVal = (int6 as any).currentEnv.get('updatedCount');
    const bobAgeVal = (int6 as any).currentEnv.get('bobAge');
    const deletedCountVal = (int6 as any).currentEnv.get('deletedCount');
    const remainingUsersVal = (int6 as any).currentEnv.get('remainingUsers');

    if (
      doc1Val && doc1Val.name === 'Alice' && doc1Val._id &&
      Array.isArray(allUsersVal) && allUsersVal.length === 2 &&
      Array.isArray(aliceVal) && aliceVal.length === 1 && aliceVal[0].name === 'Alice' &&
      updatedCountVal === 1 && bobAgeVal === 26 &&
      deletedCountVal === 1 && Array.isArray(remainingUsersVal) && remainingUsersVal.length === 1
    ) {
      console.log('  ✓ std/db document store operations validated successfully');
    } else {
      console.error('  ✗ std/db validation failed:', {
        doc1Val, allUsersVal, aliceVal, updatedCountVal, bobAgeVal, deletedCountVal, remainingUsersVal
      });
    }
  } finally {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  }

  console.log('\nAll module tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
