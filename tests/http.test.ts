// Sesi HTTP Client Builtins Test Suite
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
  console.log('=== Sesi HTTP Client Tests ===\n');

  // Test 1: web_get call to JSONPlaceholder
  const int1 = new Interpreter();
  await runTest('Execute HTTP GET via web_get', `
    let response = web_get("https://jsonplaceholder.typicode.com/posts/1")
    print "GET Response summary:" + response
  `, int1);
  const responseVal = (int1 as any).currentEnv.get('response');
  if (typeof responseVal === 'string' && responseVal.includes('"id": 1')) {
    console.log('  ✓ web_get retrieved correct payload');
  } else {
    console.error('  ✗ web_get failed, response was:', responseVal);
  }

  // Test 2: web_send (POST) call to JSONPlaceholder
  const int2 = new Interpreter();
  await runTest('Execute HTTP POST via web_send', `
    let payload = "{ \\"title\\": \\"foo\\", \\"body\\": \\"bar\\", \\"userId\\": 1 }"
    let postResponse = web_send("https://jsonplaceholder.typicode.com/posts", payload)
    print "POST Response summary:" + postResponse
  `, int2);
  const postResVal = (int2 as any).currentEnv.get('postResponse');
  if (typeof postResVal === 'string' && postResVal.includes('"id": 101')) {
    console.log('  ✓ web_send successfully posted payload');
  } else {
    console.error('  ✗ web_send failed, response was:', postResVal);
  }

  console.log('\nAll HTTP Client tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
