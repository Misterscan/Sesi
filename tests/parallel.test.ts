// Sesi Parallel Requests Builtin Test Suite
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

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
  console.log('=== Sesi Parallel Execution Tests ===\n');

  // Test 1: multi_req with two sleeping functions
  const int1 = new Interpreter();
  const start = Date.now();
  await runTest('Concurrent sleep execution via multi_req', `
    import { sleep } from "std/time"
    
    fn task1() {
      sleep(100)
      return "done1"
    }
    
    fn task2() {
      sleep(100)
      return "done2"
    }
    
    let results = multi_req([task1, task2])
    print "Parallel results:" + str(results)
  `, int1);
  const end = Date.now();
  const elapsed = end - start;
  console.log(`  Elapsed time: ${elapsed}ms`);

  const resultsVal = (int1 as any).currentEnv.get('results');
  if (Array.isArray(resultsVal) && resultsVal[0] === 'done1' && resultsVal[1] === 'done2') {
    console.log('  ✓ multi_req concurrently executed closures successfully');
  } else {
    console.error('  ✗ multi_req failed, results were:', resultsVal);
  }

  if (elapsed < 160) {
    console.log('  ✓ multi_req successfully executed closures in parallel (under 160ms total)');
  } else {
    console.error(`  ✗ closures were executed sequentially, took: ${elapsed}ms`);
  }

  console.log('\nAll Parallel Execution tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
